'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, FileVideo, AlertCircle, Ellipsis, Pencil, Trash2, Download } from "lucide-react"
import { LoaderOne } from "@/components/ui/loader"
import { Button } from "@/components/ui/button"
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
import { getCachedMediaUrl, getOrFetchMediaUrl, removeCachedMedia } from "@/lib/media-cache"

type VideoFile = {
  id: string | number
  original_filename?: string
  mime_type?: string
  mediaUrl?: string
  loadError?: boolean
  mediaLoading?: boolean
}

export default function VideosPage() {
  const router = useRouter()
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { workspaceId, currentUserRole, loadingRole, loadingWorkspaces } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()

  const [page, setPage] = useState(1)
  const pageSize = 24

  const canEdit = canEditContent(currentUserRole)
  const canDelete = canDeleteContent(currentUserRole)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  useEffect(() => {
    let cancelled = false

    if (authLoading) return
    if (!isAuthenticated) return

    if (loadingWorkspaces || loadingRole) return

    if (!workspaceId) {
      setError("No workspace selected.")
      setLoading(false)
      return
    }

    const getVideos = async () => {
      try {
        if (!ready) return
        setLoading(true)
        setError(null)

        const response = await apiFetch(
          `/workspaces/${workspaceId}/media/?page=${page}&page_size=${pageSize}&type=video`,
          { method: "GET", auth: true },
        )
        if (!response.ok) {
          const body = await response.text().catch(() => "")
          const err = new ApiError(extractErrorMessage(response.status, body), response.status, body)
          const handled = handleApiError(err)
          if (handled.kind === "not-found") {
            setVideos([])
            setError(null)
            return
          }
          setError("Unable to load videos right now.")
          return
        }

        const payload = await response.json().catch(() => ({}))
        const items: VideoFile[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : []

        const baseVideos = items
          .map((item: unknown): VideoFile | null => {
            const media = item as {
              id?: string | number
              original_filename?: string
              mime_type?: string
            }

            const id = media?.id
            if (id === undefined || id === null) return null

            const cachedUrl = getCachedMediaUrl(workspaceId, id)
            return {
              id,
              original_filename: media.original_filename,
              mime_type: media.mime_type,
              mediaUrl: cachedUrl ?? undefined,
              loadError: false,
              mediaLoading: !cachedUrl,
            }
          })
          .filter((v): v is VideoFile => v !== null)

        // Render the list immediately; fetch blobs per-card in background.
        if (!cancelled) setVideos(baseVideos)
        setLoading(false)

        const concurrency = 2
        const queue = baseVideos.filter((v) => !v.mediaUrl)
        const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
          while (queue.length) {
            const next = queue.shift()
            if (!next) break

            try {
              const url = await getOrFetchMediaUrl(workspaceId, next.id)
              if (cancelled) continue
              setVideos((prev) =>
                prev.map((v) =>
                  v.id === next.id ? { ...v, mediaUrl: url, mediaLoading: false, loadError: false } : v,
                ),
              )
            } catch {
              if (cancelled) continue
              setVideos((prev) =>
                prev.map((v) => (v.id === next.id ? { ...v, mediaLoading: false, loadError: true } : v)),
              )
            }
          }
        })

        void Promise.all(workers)
      } catch {
        setError("Unable to load videos right now.")
      } finally {
        // If we already rendered the list, don't flip loading here.
        setLoading((prev) => prev && false)
      }
    }

    getVideos()

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, loadingRole, loadingWorkspaces, page, ready, workspaceId])

  const handleEdit = async (video: VideoFile) => {
    if (!ready) return
    if (!canEdit) {
      toast.error("You do not have permission to edit media")
      return
    }
    const current = video.original_filename ?? ""
    const next = window.prompt("Rename file", current)
    if (!next || !next.trim() || next.trim() === current) return

    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/media/${video.id}`, {
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
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, original_filename: next.trim() } : v)),
      )
      toast.success("Updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VideoFile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (video: VideoFile) => {
    if (!ready) return
    if (!canDelete) {
      toast.error("You do not have permission to delete media")
      return
    }

    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/media/${video.id}`, {
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

      if (video.mediaUrl?.startsWith("blob:")) {
        removeCachedMedia(workspaceId!, video.id)
      }
      setVideos((prev) => prev.filter((v) => v.id !== video.id))
      toast.success("Deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const requestDelete = (video: VideoFile) => {
    if (!ready) return
    if (!canDelete) {
      toast.error("You do not have permission to delete media")
      return
    }
    setDeleteTarget(video)
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

  const downloadVideo = async (video: VideoFile) => {
    if (!ready) return

    const filename = (video.original_filename ?? `video-${String(video.id)}`).trim() || `video-${String(video.id)}`

    try {
      const url = video.mediaUrl ?? (await getOrFetchMediaUrl(workspaceId!, video.id))

      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      const handled = handleApiError(e)
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Download failed")
    }
  }

  return (
    <div className="container mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Videos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse and download your workspace video files.</p>
      </div>
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
              <LoaderOne />
              <p className="text-sm">Loading videos…</p>
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
          {videos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileVideo className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No video files found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload a video to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <Card 
                  key={video.id} 
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                  onClick={() => {
                    router.push(`/videos/${video.id}`)
                  }}
                >
                  <CardHeader className="flex justify-end">
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
                              void handleEdit(video)
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
                              requestDelete(video)
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-4">
                    <div
                      style={{
                        width: '100%',
                        overflow: 'hidden',
                        borderRadius: '8px'
                      }}
                    >
                      {video.mediaUrl ? (
                        <video
                          controls
                          style={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '260px',
                            display: 'block',
                            objectFit: 'contain',
                            borderRadius: '8px'
                          }}
                          preload="metadata"
                          crossOrigin="anonymous"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <source
                            src={video.mediaUrl}
                            type={video.mime_type ?? "video/mp4"}
                          />
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <div
                          className="flex items-center justify-center text-muted-foreground"
                          style={{ height: 160 }}
                        >
                          <div className="flex items-center gap-2">
                            <LoaderOne />
                            <p className="text-sm">
                              {video.mediaLoading ? "Preparing preview…" : "Preview unavailable"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="truncate text-base">
                        {video.original_filename ?? "Untitled"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        <span className="text-xs">Video</span>
                      </CardDescription>
                    </div>
                    {video.loadError && (
                      <div className="flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 dark:bg-yellow-950/20">
                        <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
                        <p className="text-xs text-yellow-600 dark:text-yellow-500">
                          Playback may be limited
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          void downloadVideo(video)
                        }}
                        disabled={!ready}
                        style={{ borderRadius: 12 }}
                        className="text-[#6F26D4] hover:bg-[#6F26D4]/10"
                      >
                        <Download className="h-4 w-4" /> Download
                      </Button>
                    </div>
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
