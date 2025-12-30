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
import { ApiError, apiFetchJson, getMyProfile, type MyProfile } from "@/lib/api"
import { handleApiError } from "@/lib/handle-api-error"
import { useAuth } from "@/lib/auth-context"
import { useWorkspace } from "@/lib/workspace-context"
import { canDeleteComment } from "@/lib/rbac"
import { getCachedMediaUrl, getOrFetchMediaUrl } from "@/lib/media-cache"

export type CommentTargetType = string

type Comment = {
  id: number | string
  target_type: string
  target_id: number | string
  body: string
  created_at?: string
  author_id?: number | string
  user_id?: number | string
  author_username?: string | null
  author_email?: string | null
  author_avatar_url?: string | null
}

type MemberRow = {
  id?: number | string
  user_id?: number | string
  username?: string | null
  email?: string | null
  avatar_url?: string | null
}

function parseAvatarMediaRef(value: string | null | undefined): { workspaceId: string; mediaId: string } | null {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return null

  // media:<workspaceId>:<mediaId>
  if (trimmed.startsWith("media:")) {
    const parts = trimmed.split(":")
    if (parts.length !== 3) return null
    const workspaceId = parts[1]
    const mediaId = parts[2]
    if (!workspaceId || !mediaId) return null
    return { workspaceId, mediaId }
  }

  // /workspaces/<workspaceId>/media/<mediaId>/download (relative or absolute)
  const m = trimmed.match(/\/workspaces\/([^/]+)\/media\/([^/]+)\/download\b/)
  if (!m) return null
  const workspaceId = m[1]
  const mediaId = m[2]
  if (!workspaceId || !mediaId) return null
  return { workspaceId, mediaId }
}

function normalizeId(value: unknown): string {
  return String(value ?? "")
}

function getAuthorId(c: Comment): string | null {
  const raw = c.author_id ?? c.user_id
  if (raw === undefined || raw === null) return null
  return String(raw)
}

function getAuthorInitial(c: Comment): string {
  const username = String(c.author_username ?? "").trim()
  if (username) return username[0].toUpperCase()
  const email = String(c.author_email ?? "").trim()
  if (email) return email[0].toUpperCase()
  return "U"
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

  const [memberAvatarRawByUserId, setMemberAvatarRawByUserId] = useState<Record<string, string | null>>({})
  const [memberAvatarResolvedByUserId, setMemberAvatarResolvedByUserId] = useState<Record<string, string | null>>({})

  const [commentAvatarRawByUserId, setCommentAvatarRawByUserId] = useState<Record<string, string | null>>({})

  const [meProfile, setMeProfile] = useState<MyProfile | null>(null)
  const [meAvatarResolvedUrl, setMeAvatarResolvedUrl] = useState<string | null>(null)

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

      const nextCommentAvatars: Record<string, string | null> = {}
      for (const c of all) {
        const authorId = getAuthorId(c)
        if (!authorId) continue
        const raw = String(c.author_avatar_url ?? "").trim()
        if (raw) nextCommentAvatars[normalizeId(authorId)] = raw
      }
      setCommentAvatarRawByUserId(nextCommentAvatars)

      // Best-effort: load member avatars once so we can show them next to authors.
      try {
        const payload = await apiFetchJson<unknown>(`/workspaces/${workspaceId}/members`, {
          method: "GET",
          auth: true,
        })

        const members: MemberRow[] = Array.isArray(payload)
          ? (payload as MemberRow[])
          : Array.isArray((payload as { items?: unknown })?.items)
            ? (((payload as { items?: unknown }).items as unknown[]) as MemberRow[])
            : []

        const next: Record<string, string | null> = {}
        for (const m of members) {
          const id = normalizeId(m.user_id ?? m.id)
          if (!id) continue
          const anyMember = m as unknown as Record<string, unknown>
          const candidate =
            anyMember.avatar_url ??
            anyMember.avatarUrl ??
            anyMember.avatar ??
            anyMember.profile_image_url ??
            anyMember.profileImageUrl ??
            anyMember.profile_photo_url ??
            anyMember.picture

          const raw = String(candidate ?? "").trim()
          next[id] = raw ? raw : null
        }

        setMemberAvatarRawByUserId(next)
      } catch {
        // ignore; comments will render without avatars
        setMemberAvatarRawByUserId({})
      }
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
      setMemberAvatarRawByUserId({})
      setMemberAvatarResolvedByUserId({})
      return
    }

    if (loadingWorkspaces || loadingRole) {
      setLoading(true)
      return
    }

    void load()
  }, [authLoading, isAuthenticated, load, loadingRole, loadingWorkspaces, workspaceId])

  useEffect(() => {
    if (!ready) return

    let cancelled = false
    void getMyProfile()
      .then((p) => {
        if (!cancelled) setMeProfile(p)
      })
      .catch(() => {
        // ignore; comments can still render
      })

    return () => {
      cancelled = true
    }
  }, [ready])

  useEffect(() => {
    const raw = String(meProfile?.avatar_url ?? "").trim()
    const ref = parseAvatarMediaRef(raw)
    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) setMeAvatarResolvedUrl(null)
    })

    if (!raw) {
      return () => {
        cancelled = true
      }
    }

    if (!ref) {
      queueMicrotask(() => {
        if (!cancelled) setMeAvatarResolvedUrl(raw)
      })
      return () => {
        cancelled = true
      }
    }

    const cached = getCachedMediaUrl(ref.workspaceId, ref.mediaId)
    if (cached) {
      queueMicrotask(() => {
        if (!cancelled) setMeAvatarResolvedUrl(cached)
      })
      return () => {
        cancelled = true
      }
    }

    void getOrFetchMediaUrl(ref.workspaceId, ref.mediaId)
      .then((url) => {
        if (!cancelled) setMeAvatarResolvedUrl(url)
      })
      .catch(() => {
        // ignore
      })

    return () => {
      cancelled = true
    }
  }, [meProfile?.avatar_url])

  useEffect(() => {
    let cancelled = false
    const mergedRaw: Record<string, string | null> = { ...memberAvatarRawByUserId, ...commentAvatarRawByUserId }
    const entries = Object.entries(mergedRaw)

    if (entries.length === 0) {
      setMemberAvatarResolvedByUserId({})
      return
    }

    void (async () => {
      const next: Record<string, string | null> = {}
      await Promise.all(
        entries.map(async ([userId, raw]) => {
          const trimmed = String(raw ?? "").trim()
          if (!trimmed) {
            next[userId] = null
            return
          }

          const ref = parseAvatarMediaRef(trimmed)
          if (!ref) {
            next[userId] = trimmed
            return
          }

          const cached = getCachedMediaUrl(ref.workspaceId, ref.mediaId)
          if (cached) {
            next[userId] = cached
            return
          }

          try {
            next[userId] = await getOrFetchMediaUrl(ref.workspaceId, ref.mediaId)
          } catch {
            next[userId] = null
          }
        }),
      )

      if (!cancelled) setMemberAvatarResolvedByUserId(next)
    })()

    return () => {
      cancelled = true
    }
  }, [commentAvatarRawByUserId, memberAvatarRawByUserId])

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
      await apiFetchJson<{ detail: string }>(
        `/workspaces/${workspaceId}/comments/${deleteTarget.id}`,
        { method: "DELETE", auth: true },
      )

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
              const author = c.author_username ?? c.author_email ?? "Unknown"
              const when = c.created_at ? new Date(c.created_at).toLocaleString() : null
              const authorId = getAuthorId(c)
              const isMe = authorId && userId !== null && userId !== undefined && normalizeId(authorId) === normalizeId(userId)
              const fromMembers = authorId ? memberAvatarResolvedByUserId[normalizeId(authorId)] : null
              const avatarUrl = (isMe ? meAvatarResolvedUrl : null) ?? fromMembers

              return (
                <div
                  key={String(c.id)}
                  className="rounded-lg border bg-background p-3"
                  style={{ borderRadius: 14 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <div
                        className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full border bg-muted"
                        style={{ borderRadius: 9999 }}
                      >
                        {avatarUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={avatarUrl} alt="Avatar" className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                            {getAuthorInitial(c)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{author}</div>
                        {when && <div className="text-xs text-muted-foreground">{when}</div>}
                      </div>
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
