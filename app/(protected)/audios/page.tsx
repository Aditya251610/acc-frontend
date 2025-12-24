'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Music, FileAudio, AlertCircle, Ellipsis, Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
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
import { toast } from "sonner"
import { ApiError, apiFetch, extractErrorMessage } from "@/lib/api"
import { handleApiError } from "@/lib/handle-api-error"
import { useWorkspace } from "@/lib/workspace-context"
import { canDeleteContent, canEditContent } from "@/lib/rbac"
import { useAuth } from "@/lib/auth-context"

type AudioFile = {
  id: string | number
  original_filename?: string
  mime_type?: string
  mediaUrl?: string
  loadError?: boolean
}

export default function AudiosPage() {
  const router = useRouter()
  const [audios, setAudios] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { workspaceId, currentUserRole, loadingRole, loadingWorkspaces } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()

  const [page, setPage] = useState(1)
  const pageSize = 24

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AudioFile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canEdit = canEditContent(currentUserRole)
  const canDelete = canDeleteContent(currentUserRole)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  useEffect(() => {
    const revoked: string[] = []

    if (authLoading) return
    if (!isAuthenticated) return

    if (loadingWorkspaces || loadingRole) return

    if (!workspaceId) {
      setError("No workspace selected.")
      setLoading(false)
      return () => {
        revoked.forEach((url) => URL.revokeObjectURL(url))
      }
    }

    const getAudios = async () => {
      try {
        if (!ready) return
        const response = await apiFetch(
          `/workspaces/${workspaceId}/media/?page=${page}&page_size=${pageSize}&type=audio`,
          { method: "GET", auth: true },
        )
        if (!response.ok) {
          const body = await response.text().catch(() => "")
          const err = new ApiError(extractErrorMessage(response.status, body), response.status, body)
          const handled = handleApiError(err)
          if (handled.kind === "not-found") {
            setAudios([])
            setError(null)
            return
          }
          setError("No audios available right now.")
          return
        }

        const payload = await response.json().catch(() => ({}))
        const items: AudioFile[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : []

        const filesWithMediaUrl = (await Promise.all(
          items.map(async (item: unknown): Promise<AudioFile | null> => {
            const media = item as {
              id?: string | number
              original_filename?: string
              mime_type?: string
            }

            const id = media?.id
            if (id === undefined || id === null) return null

            try {
              const fileResp = await apiFetch(
                `/workspaces/${workspaceId}/media/${id}/download`,
                { method: "GET", auth: true },
              )

              if (!fileResp.ok) {
                throw new Error(`Failed to fetch audio: ${fileResp.status} ${fileResp.statusText}`)
              }

              const blob = await fileResp.blob()
              const objectUrl = URL.createObjectURL(blob)
              revoked.push(objectUrl)
              return {
                id,
                original_filename: media.original_filename,
                mime_type: media.mime_type,
                mediaUrl: objectUrl,
              }
            } catch {
              return {
                id,
                original_filename: media.original_filename,
                mime_type: media.mime_type,
                loadError: true,
              }
            }
          }),
        ))
          .filter((a): a is AudioFile => a !== null)

        setAudios(filesWithMediaUrl)
      } catch {
        setError("No audios available right now.")
      } finally {
        setLoading(false)
      }
    }

    getAudios()

    return () => {
      revoked.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [authLoading, isAuthenticated, loadingRole, loadingWorkspaces, page, ready, workspaceId])

  const handleEdit = async (audio: AudioFile) => {
    if (!ready) return
    if (!canEdit) {
      toast.error("You do not have permission to edit media")
      return
    }
    const current = audio.original_filename ?? ""
    const next = window.prompt("Rename file", current)
    if (!next || !next.trim() || next.trim() === current) return

    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/media/${audio.id}`, {
        method: "PUT",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_filename: next.trim() }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const err = new ApiError(extractErrorMessage(res.status, text), res.status, text)
        const handled = handleApiError(err)
        if (!handled.handled) throw err
        return
      }
      setAudios((prev) =>
        prev.map((a) => (a.id === audio.id ? { ...a, original_filename: next.trim() } : a)),
      )
      toast.success("Updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    }
  }

  const handleDelete = async (audio: AudioFile) => {
    if (!ready) return
    if (!canDelete) {
      toast.error("You do not have permission to delete media")
      return
    }

    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/media/${audio.id}`, {
        method: "DELETE",
        auth: true,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const err = new ApiError(extractErrorMessage(res.status, text), res.status, text)
        const handled = handleApiError(err)
        if (!handled.handled) throw err
        return
      }

      if (audio.mediaUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(audio.mediaUrl)
      }
      setAudios((prev) => prev.filter((a) => a.id !== audio.id))
      toast.success("Deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const requestDelete = (audio: AudioFile) => {
    if (!ready) return
    if (!canDelete) {
      toast.error("You do not have permission to delete media")
      return
    }
    setDeleteTarget(audio)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await handleDelete(deleteTarget)
      setDeleteOpen(false)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return
          setDeleteOpen(open)
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete media?</AlertDialogTitle>
            <AlertDialogDescription>This action can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} style={{ borderRadius: 12 }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => void confirmDelete()}
              style={{ borderRadius: 12 }}
              className="border border-red-500 bg-transparent text-red-600 hover:bg-red-50 hover:text-red-600 dark:border-red-500/60 dark:hover:bg-red-950/20"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!loading && error === "No workspace selected." && (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              No workspace selected. Go to{" "}
              <Link className="text-[#6F26D4] underline" href="/dashboard">
                Dashboard
              </Link>
              {" "}and select or create one.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileAudio className="h-5 w-5 animate-pulse" />
              <p className="text-sm">Loading audios…</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && error !== "No workspace selected." && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 py-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {!loadingRole && !canEdit && (
            <Card className="mb-6">
              <CardContent className="py-4 text-sm text-muted-foreground">
                Read-only access in this workspace.
              </CardContent>
            </Card>
          )}
          {audios.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileAudio className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No audio files found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload an audio file to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {audios.map((audio) => (
                <Card 
                  key={audio.id} 
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                  onClick={() => {
                    router.push(`/audios/${audio.id}`)
                  }}
                >
                  <CardHeader className="pb-1 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="More options"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Ellipsis className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6}>
                        {canEdit && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleEdit(audio)
                            }}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              requestDelete(audio)
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4">
                    <div className="w-full bg-muted p-3 overflow-hidden" style={{ borderRadius: '0.5rem' }}>
                      <audio
                        controls
                        className="h-9 w-full"
                        style={{ borderRadius: '0.5rem' }}
                        preload="metadata"
                        crossOrigin="anonymous"
                      >
                        <source
                          src={audio.mediaUrl}
                          type={audio.mime_type ?? "audio/mpeg"}
                        />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="truncate text-base">
                        {audio.original_filename ?? "Untitled"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Music className="h-3 w-3" />
                        <span className="text-xs">Audio</span>
                      </CardDescription>
                    </div>
                    {audio.loadError && (
                      <div className="flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 dark:bg-yellow-950/20">
                        <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">
                          Playback may be limited
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <div className="text-sm text-muted-foreground">Page {page}</div>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
