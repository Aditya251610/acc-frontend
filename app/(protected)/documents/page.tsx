"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { FileText, Plus, Paperclip } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiError, apiFetch, apiFetchJson, extractErrorMessage } from "@/lib/api"
import { handleApiError } from "@/lib/handle-api-error"
import { useAuth } from "@/lib/auth-context"
import { useWorkspace } from "@/lib/workspace-context"
import { canDeleteContent, canEditContent } from "@/lib/rbac"

type DocumentItem = {
  id: number | string
  workspace_id?: number
  title?: string
  content?: string | null
  media_id?: number | null
  doc_type?: string
  version?: number
  created_at?: string
  updated_at?: string
}

type MediaItem = {
  id: number | string
  original_filename?: string
  mime_type?: string
}

type ListRow =
  | { kind: "document"; id: number | string; title: string }
  | { kind: "file"; id: number | string; title: string; mime_type?: string }

function normalizeId(v: unknown) {
  return String(v ?? "")
}

export default function DocumentsPage() {
  const { workspaceId, currentUserRole, loadingRole, loadingWorkspaces } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()

  const [items, setItems] = useState<DocumentItem[]>([])
  const [files, setFiles] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [creating, setCreating] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canCreate = canEditContent(currentUserRole)
  const canDelete = canDeleteContent(currentUserRole)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  const fileMimeTypes = useMemo(
    () =>
      new Set([
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]),
    [],
  )

  const load = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    try {
      const [docsResult, mediaResult] = await Promise.allSettled([
        apiFetchJson<unknown>(`/workspaces/${workspaceId}/documents`, {
          method: "GET",
          auth: true,
        }),
        (async () => {
          // Per backend schema: `type` is optional mime-prefix filter.
          // Also avoid overly large page_size which can trigger 422 if backend caps it.
          const pageSize = 100
          const [applicationRes, textRes] = await Promise.all([
            apiFetch(`/workspaces/${workspaceId}/media?page=1&page_size=${pageSize}&type=application`, {
              method: "GET",
              auth: true,
            }),
            apiFetch(`/workspaces/${workspaceId}/media?page=1&page_size=${pageSize}&type=text`, {
              method: "GET",
              auth: true,
            }),
          ])

          // Always return both; downstream will parse/merge.
          return { applicationRes, textRes }
        })(),
      ])

      if (docsResult.status === "fulfilled") {
        const payload = docsResult.value
        const docs: DocumentItem[] = Array.isArray(payload)
          ? (payload as DocumentItem[])
          : Array.isArray((payload as { items?: unknown }).items)
            ? ((payload as { items: unknown[] }).items as DocumentItem[])
            : []

        setItems(docs.filter((d) => d && d.id !== undefined && d.id !== null))
      } else {
        const e = docsResult.reason
        const handled = handleApiError(e)
        if (handled.kind === "not-found") {
          setItems([])
        } else if (!(e instanceof ApiError)) {
          toast.error("Failed to load documents")
        }
      }

      if (mediaResult.status === "fulfilled") {
        const { applicationRes, textRes } = mediaResult.value

        const parseItems = async (res: Response) => {
          const payload = await res.json().catch(() => ({}))
          const raw: MediaItem[] = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as { items?: unknown }).items)
              ? (((payload as { items: unknown[] }).items ?? []) as MediaItem[])
              : []
          return raw
        }

        const errors: ApiError[] = []
        const all: MediaItem[] = []

        for (const res of [applicationRes, textRes]) {
          if (res.ok) {
            all.push(...(await parseItems(res)))
          } else {
            const body = await res.text().catch(() => "")
            errors.push(new ApiError(extractErrorMessage(res.status, body), res.status, body))
          }
        }

        if (all.length === 0 && errors.length > 0) {
          const handled = handleApiError(errors[0])
          if (handled.kind === "not-found") setFiles([])
        } else {
          const byId = new Map<string, MediaItem>()
          for (const m of all) {
            if (!m || m.id === undefined || m.id === null) continue
            byId.set(String(m.id), m)
          }
          const filtered = Array.from(byId.values()).filter((m) => fileMimeTypes.has(m.mime_type ?? ""))
          setFiles(filtered)
        }
      } else {
        const e = mediaResult.reason
        const handled = handleApiError(e)
        if (handled.kind === "not-found") setFiles([])
      }
    } catch (e) {
      const handled = handleApiError(e)
      if (handled.kind === "not-found") {
        setItems([])
      } else if (!(e instanceof ApiError)) {
        toast.error("Failed to load documents")
      }
    } finally {
      setLoading(false)
    }
  }, [fileMimeTypes, ready, workspaceId])

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      setItems([])
      setLoading(false)
      return
    }

    if (!workspaceId) {
      setItems([])
      setLoading(false)
      return
    }

    if (loadingWorkspaces || loadingRole) {
      setLoading(true)
      return
    }

    void load()
  }, [authLoading, isAuthenticated, loadingRole, loadingWorkspaces, load, workspaceId])

  const onCreate = useCallback(async () => {
    if (!ready) return
    if (!canCreate) {
      toast.error("You do not have permission to create documents")
      return
    }

    const t = title.trim()
    const c = content.trim()
    if (!t) return
    if (!c) {
      toast.error("Content cannot be empty")
      return
    }

    setCreating(true)
    try {
      const created = await apiFetchJson<DocumentItem>(`/workspaces/${workspaceId}/documents`, {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content: c }),
      })

      setItems((prev) => [created, ...prev])
      setTitle("")
      setContent("")
      toast.success("Document created")
    } catch (e) {
      const handled = handleApiError(e)
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }, [canCreate, content, ready, title, workspaceId])

  const performDelete = useCallback(
    async (doc: DocumentItem) => {
      if (!ready) return
      if (!canDelete) {
        toast.error("You do not have permission to delete documents")
        return
      }

      if (deleting) return

      try {
        setDeleting(true)
        await apiFetchJson<void>(`/workspaces/${workspaceId}/documents/${doc.id}`, {
          method: "DELETE",
          auth: true,
        })
        setItems((prev) => prev.filter((d) => normalizeId(d.id) !== normalizeId(doc.id)))
        toast.success("Deleted")
        setDeleteOpen(false)
        setDeleteTarget(null)
      } catch (e) {
        const handled = handleApiError(e)
        if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Delete failed")
      } finally {
        setDeleting(false)
      }
    },
    [canDelete, deleting, ready, workspaceId],
  )

  const requestDelete = useCallback(
    (doc: DocumentItem) => {
      if (!ready) return
      if (!canDelete) {
        toast.error("You do not have permission to delete documents")
        return
      }
      setDeleteTarget(doc)
      setDeleteOpen(true)
    },
    [canDelete, ready],
  )

  const sorted = useMemo(() => items, [items])

  const rows = useMemo<ListRow[]>(() => {
    const docRows: ListRow[] = sorted.map((d) => ({
      kind: "document",
      id: d.id,
      title: d.title ?? "Untitled",
    }))

    const fileRows: ListRow[] = files.map((f) => ({
      kind: "file",
      id: f.id,
      title: f.original_filename ?? "Untitled file",
      mime_type: f.mime_type,
    }))

    return [...docRows, ...fileRows]
  }, [files, sorted])

  const onOpenFile = useCallback(
    async (file: { id: number | string; title: string; mime_type?: string }) => {
      if (!ready) return

      try {
        const res = await apiFetch(`/workspaces/${workspaceId}/media/${file.id}/download`, {
          method: "GET",
          auth: true,
        })

        if (!res.ok) {
          const body = await res.text().catch(() => "")
          const err = new ApiError(extractErrorMessage(res.status, body), res.status, body)
          const handled = handleApiError(err)
          if (!handled.handled) toast.error("Failed to download file")
          return
        }

        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        const mime = file.mime_type ?? blob.type

        const shouldOpen = mime === "application/pdf" || mime === "text/plain"
        if (shouldOpen) {
          window.open(objectUrl, "_blank", "noopener,noreferrer")
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
          return
        }

        const a = document.createElement("a")
        a.href = objectUrl
        a.download = file.title
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(objectUrl)
      } catch (e) {
        const handled = handleApiError(e)
        if (!handled.handled) toast.error(e instanceof Error ? e.message : "Download failed")
      }
    },
    [ready, workspaceId],
  )

  return (
    <div className="container mx-auto p-6">
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} style={{ borderRadius: 12 }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) void performDelete(deleteTarget)
              }}
              style={{ borderRadius: 12 }}
              className="border border-red-500 bg-transparent text-red-600 hover:bg-red-50 hover:text-red-600 dark:border-red-500/60 dark:hover:bg-red-950/20"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace-scoped text documents.
          </p>
        </div>
      </div>

      {!loadingRole && !canCreate && (
        <Card className="mt-6">
          <CardContent className="py-4 text-sm text-muted-foreground">
            You have read-only access in this workspace.
          </CardContent>
        </Card>
      )}

      <Card className="mt-6" style={{ borderRadius: 16 }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Create document
          </CardTitle>
          <CardDescription>Simple editor (no realtime).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ borderRadius: 12 }}
          />
          <Textarea
            placeholder="Write here…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => void onCreate()}
              disabled={!ready || !title.trim() || creating || !canCreate}
              className="bg-[#6F26D4] text-white hover:bg-[#6F26D4]/90"
              style={{ borderRadius: 12 }}
            >
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6" style={{ borderRadius: 16 }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Your documents
          </CardTitle>
          <CardDescription>Click to view/edit.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No documents yet.</div>
          ) : (
            <div className="grid gap-2">
              {rows.map((row) => (
                <div
                  key={`${row.kind}-${String(row.id)}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                  style={{ borderRadius: 14 }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {row.kind === "file" ? (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="truncate text-sm font-medium">{row.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {row.kind === "file" ? "FILE" : "DOC"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {row.kind === "document" ? (
                      <>
                        <Link
                          href={`/documents/${row.id}`}
                          className="text-sm text-[#6F26D4] underline"
                        >
                          Open
                        </Link>
                        <Button
                          variant="outline"
                          onClick={() => requestDelete({ id: row.id, title: row.title })}
                          disabled={!canDelete}
                          style={{ borderRadius: 12 }}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => void onOpenFile(row)}
                        disabled={!ready}
                        style={{ borderRadius: 12 }}
                        className="text-[#6F26D4] hover:bg-[#6F26D4]/10"
                      >
                        Open
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
