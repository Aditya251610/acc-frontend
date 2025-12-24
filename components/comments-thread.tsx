"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { canDeleteComment } from "@/lib/rbac"

export type CommentTargetType = string

type Comment = {
  id: number | string
  target_type: string
  target_id: number | string
  body: string
  created_at?: string
  author_id?: number | string
  user_id?: number | string
  username?: string
}

function normalizeId(value: unknown): string {
  return String(value ?? "")
}

function getAuthorId(c: Comment): string | null {
  const raw = c.author_id ?? c.user_id
  if (raw === undefined || raw === null) return null
  return String(raw)
}

export default function CommentsThread({
  targetType,
  targetId,
  title = "Comments",
}: {
  targetType: CommentTargetType
  targetId: string | number
  title?: string
}) {
  const { workspaceId, currentUserRole, loadingRole, loadingWorkspaces } = useWorkspace()
  const { userId, loading: authLoading, isAuthenticated } = useAuth()

  const [items, setItems] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  const filtered = useMemo(() => {
    return items.filter(
      (c) =>
        String(c.target_type).toLowerCase() === String(targetType).toLowerCase() &&
        normalizeId(c.target_id) === normalizeId(targetId),
    )
  }, [items, targetId, targetType])

  const load = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    try {
      const all = await apiFetchJson<Comment[]>(`/workspaces/${workspaceId}/comments`, {
        method: "GET",
        auth: true,
      })
      setItems(all)
    } catch (e) {
      const handled = handleApiError(e)
      if (handled.kind === "not-found") {
        setItems([])
      } else if (!(e instanceof ApiError)) {
        toast.error("Failed to load comments")
      }
    } finally {
      setLoading(false)
    }
  }, [ready, workspaceId])

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated || !workspaceId) {
      setItems([])
      setLoading(false)
      return
    }

    if (loadingWorkspaces || loadingRole) {
      setLoading(true)
      return
    }

    void load()
  }, [authLoading, isAuthenticated, load, loadingRole, loadingWorkspaces, workspaceId])

  const onCreate = useCallback(async () => {
    if (!ready) return
    const body = message.trim()
    if (!body) return

    try {
      const created = await apiFetchJson<Comment>(`/workspaces/${workspaceId}/comments`, {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          body,
        }),
      })

      setItems((prev) => [created, ...prev])
      setMessage("")
      toast.success("Comment posted")
    } catch (e) {
      const handled = handleApiError(e)
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Failed to post comment")
    }
  }, [message, ready, targetId, targetType, workspaceId])

  const requestDelete = useCallback(
    (comment: Comment) => {
      if (!ready) return

      const isAuthor =
        userId !== null && userId !== undefined
          ? normalizeId(getAuthorId(comment)) === normalizeId(userId)
          : false

      if (!canDeleteComment({ role: currentUserRole, isAuthor })) {
        toast.error("You do not have permission to delete this comment")
        return
      }

      setDeleteTarget(comment)
      setDeleteOpen(true)
    },
    [currentUserRole, ready, userId],
  )

  const confirmDelete = useCallback(async () => {
    if (!ready) return
    if (!deleteTarget) return
    if (deleting) return

    setDeleting(true)
    try {
      const res = await apiFetch(`/workspaces/${workspaceId}/comments/${deleteTarget.id}`, {
        method: "DELETE",
        auth: true,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new ApiError(extractErrorMessage(res.status, body), res.status, body)
      }

      setItems((prev) => prev.filter((c) => normalizeId(c.id) !== normalizeId(deleteTarget.id)))
      toast.success("Deleted")
      setDeleteOpen(false)
      setDeleteTarget(null)
    } catch (e) {
      const handled = handleApiError(e)
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, ready, workspaceId])

  return (
    <>
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
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
                void confirmDelete()
              }}
              style={{ borderRadius: 12 }}
              className="border border-red-500 bg-transparent text-red-600 hover:bg-red-50 hover:text-red-600 dark:border-red-500/60 dark:hover:bg-red-950/20"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card style={{ borderRadius: 16 }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a comment…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => void onCreate()}
              disabled={!ready || !message.trim()}
              className="bg-[#6F26D4] text-white hover:bg-[#6F26D4]/90"
              style={{ borderRadius: 12 }}
            >
              Post
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No comments yet.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const author = c.username ?? (getAuthorId(c) ? `User ${getAuthorId(c)}` : "Unknown")
              const when = c.created_at ? new Date(c.created_at).toLocaleString() : null

              return (
                <div
                  key={String(c.id)}
                  className="rounded-lg border bg-background p-3"
                  style={{ borderRadius: 14 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{author}</div>
                      {when && (
                        <div className="text-xs text-muted-foreground">{when}</div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => requestDelete(c)}
                      className="text-muted-foreground hover:text-destructive"
                      style={{ borderRadius: 12 }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-2 text-sm whitespace-pre-wrap break-words">
                    {c.body}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => void load()}
            style={{ borderRadius: 12 }}
          >
            Refresh
          </Button>
        </div>
        </CardContent>
      </Card>
    </>
  )
}
