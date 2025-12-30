"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, FileText, Save } from "lucide-react"

import { LoaderOne } from "@/components/ui/loader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import CommentsThread from "@/components/comments-thread"
import { ApiError, apiFetchJson } from "@/lib/api"
import { handleApiError } from "@/lib/handle-api-error"
import { useAuth } from "@/lib/auth-context"
import { useWorkspace } from "@/lib/workspace-context"
import { canEditContent } from "@/lib/rbac"

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

function extractDocumentContent(doc: DocumentItem): string {
  // Backend schema: content may be omitted from GET response; treat as optional.
  if (typeof doc.content === "string") return doc.content
  return ""
}

function getDocCacheKey(workspaceId: number, docId: string) {
  return `docContent:${workspaceId}:${docId}`
}

export default function DocumentDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)

  const { workspaceId, currentUserRole, loadingRole, loadingWorkspaces } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()
  const canEdit = canEditContent(currentUserRole)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  const [doc, setDoc] = useState<DocumentItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  const initializedForDocIdRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    try {
      const direct = await apiFetchJson<DocumentItem>(
        `/workspaces/${workspaceId}/documents/${id}`,
        { method: "GET", auth: true },
      )
      setDoc(direct)

      // Initialize editor state once per doc id; do not clobber user edits on rerenders.
      if (initializedForDocIdRef.current !== id) {
        setTitle(direct.title ?? "")
        // Per schema, GET may not return `content`. Use local cache (written on save) as fallback.
        const fromApi = extractDocumentContent(direct)
        let fromCache = ""
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem(getDocCacheKey(workspaceId, id))
          if (typeof cached === "string") fromCache = cached
        }
        setContent(fromApi || fromCache)
        initializedForDocIdRef.current = id
      }
    } catch (e) {
      const handled = handleApiError(e)
      if (handled.kind === "not-found") {
        setDoc(null)
        return
      }
      toast.error(e instanceof Error ? e.message : "Failed to load document")
      router.push("/documents")
    } finally {
      setLoading(false)
    }
  }, [id, ready, router, workspaceId])

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      setDoc(null)
      setLoading(false)
      return
    }

    if (!workspaceId) {
      setDoc(null)
      setLoading(false)
      return
    }

    if (loadingWorkspaces || loadingRole) {
      setLoading(true)
      return
    }

    void load()
  }, [authLoading, isAuthenticated, load, loadingRole, loadingWorkspaces, workspaceId])

  const onSave = useCallback(async () => {
    if (!ready || !doc) return
    if (!canEdit) {
      toast.error("You do not have permission to edit documents")
      return
    }

    const t = title.trim() || "Untitled"
    const c = content.trim()
    if (!c) {
      toast.error("Content cannot be empty")
      return
    }

    // Requested: log payload before API call (for debugging persistence).
    console.log("Document save payload", { title: t, content: c })

    setSaving(true)
    try {
      const updated = await apiFetchJson<DocumentItem>(
        `/workspaces/${workspaceId}/documents/${doc.id}`,
        {
          method: "PUT",
          auth: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, content: c }),
        },
      )
      setDoc(updated)
      setTitle(t)
      setContent(c)
      if (typeof window !== "undefined") {
        localStorage.setItem(getDocCacheKey(workspaceId, String(doc.id)), c)
      }
      toast.success("Saved")
    } catch (e) {
      const handled = handleApiError(e)
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }, [canEdit, content, doc, ready, title, workspaceId])

  const subtitle = useMemo(() => {
    if (!doc) return null
    const t = doc.updated_at ?? doc.created_at
    if (!t) return null
    return new Date(t).toLocaleString()
  }, [doc])

  if (loading) {
    return (
      <div className="container mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderOne />
          <span>Loading…</span>
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="container mx-auto">
        <div className="text-sm text-muted-foreground">Document not found.</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Documents
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" style={{ borderRadius: 16 }}>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="truncate">{doc.title ?? "Untitled"}</span>
            </CardTitle>
            {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              style={{ borderRadius: 12 }}
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!canEdit}
              rows={14}
              placeholder="Write here…"
              className="min-h-[220px] sm:min-h-[320px]"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => void onSave()}
                disabled={!canEdit || saving}
                className="bg-[#6F26D4] text-white hover:bg-[#6F26D4]/90"
                style={{ borderRadius: 12 }}
              >
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <CommentsThread targetType="document" targetId={doc.id} title="Document comments" />
      </div>
    </div>
  )
}
