"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Shield, UserPlus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiError, apiFetch, apiFetchJson, extractErrorMessage } from "@/lib/api"
import { handleApiError } from "@/lib/handle-api-error"
import { useAuth } from "@/lib/auth-context"
import { useWorkspace } from "@/lib/workspace-context"
import { canAssignOwner, canManageMembers } from "@/lib/rbac"

type Member = {
  id?: number | string
  user_id?: number | string
  role?: string
  username?: string
  email?: string
}

type UserLike = {
  id?: number | string
  user_id?: number | string
  username?: string
  name?: string
  email?: string
}

function toUserKey(member: Member) {
  const key = member.user_id ?? member.id
  return String(key ?? "").trim()
}

function extractUsername(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const u = payload as Record<string, unknown>

  const candidates = [u.username, u.name, u.email]
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim()
  }

  const nested = (u.user ?? u.account ?? u.profile) as Record<string, unknown> | undefined
  if (nested && typeof nested === "object") {
    const nestedCandidates = [nested.username, nested.name, nested.email]
    for (const c of nestedCandidates) {
      if (typeof c === "string" && c.trim()) return c.trim()
    }
  }

  return null
}

function normalizeMember(raw: unknown): Member {
  const m = raw as Record<string, unknown>
  const user = (m?.user ?? m?.account ?? m?.profile) as Record<string, unknown> | undefined

  const id = m?.id as Member["id"]
  const user_id = (m?.user_id ?? m?.userId ?? user?.id ?? user?.user_id) as Member["user_id"]
  const role = (m?.role ?? m?.member_role ?? m?.workspace_role) as Member["role"]
  const username = (
    m?.username ??
    m?.user_username ??
    m?.user_name ??
    m?.userName ??
    user?.username ??
    user?.name
  ) as Member["username"]
  const email = (m?.email ?? user?.email) as Member["email"]

  return { id, user_id, role, username, email }
}

function normalizeId(value: unknown) {
  return String(value ?? "")
}

const ROLE_OPTIONS = ["OWNER", "ADMIN", "EDITOR", "REVIEWER", "VIEWER"] as const

export default function MembersPage() {
  const { workspaceId, currentUserRole, loadingRole, loadingWorkspaces } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()

  const [items, setItems] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)

  const [usernamesById, setUsernamesById] = useState<Record<string, string>>({})

  const [userId, setUserId] = useState("")
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("VIEWER")
  const [adding, setAdding] = useState(false)

  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)

  const canManage = canManageMembers(currentUserRole)
  const canSetOwner = canAssignOwner(currentUserRole)

  const ready = !authLoading && isAuthenticated && !loadingWorkspaces && !!workspaceId && !loadingRole

  const load = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    try {
      const payload = await apiFetchJson<unknown>(`/workspaces/${workspaceId}/members`, {
        method: "GET",
        auth: true,
      })

      const members: Member[] = Array.isArray(payload)
        ? (payload as Member[])
        : Array.isArray((payload as { items?: unknown }).items)
          ? ((payload as { items: unknown[] }).items as Member[])
          : []

      const normalized = members.map(normalizeMember)

      // Seed username cache from list response.
      setUsernamesById((prev) => {
        const next = { ...prev }
        for (const m of normalized) {
          const k = toUserKey(m)
          if (!k) continue
          if (m.username && !next[k]) next[k] = m.username
        }
        return next
      })

      setItems(normalized)
    } catch (e) {
      const handled = handleApiError(e)
      if (handled.kind === "not-found") {
        setItems([])
      } else if (!(e instanceof ApiError)) {
        toast.error("Failed to load members")
      }
    } finally {
      setLoading(false)
    }
  }, [ready, workspaceId])

  const fetchUsernameByUserId = useCallback(
    async (userId: string) => {
      if (!ready) return
      if (!userId) return
      if (usernamesById[userId]) return

      // Best-effort: support common backends without requiring a schema change.
      const tryPaths = [
        `/users/${userId}`,
        `/users/${userId}/profile`,
        `/users/${userId}/public`,
        `/user/${userId}`,
      ]

      for (const path of tryPaths) {
        try {
          const payload = await apiFetchJson<unknown>(path, { method: "GET", auth: true })
          const name = extractUsername(payload)
          if (name) {
            setUsernamesById((prev) => ({ ...prev, [userId]: name }))
            return
          }
        } catch (e) {
          if (e instanceof ApiError) {
            if (e.status === 401 || e.status === 403) {
              handleApiError(e)
              return
            }
            // Ignore 404/405 and try next candidate path.
            if (e.status === 404 || e.status === 405) continue
          }
        }
      }
    },
    [ready, usernamesById],
  )

  useEffect(() => {
    if (!ready) return

    const missing = new Set<string>()
    for (const m of items) {
      const k = toUserKey(m)
      if (!k) continue
      if (m.username) continue
      if (!usernamesById[k]) missing.add(k)
    }

    if (missing.size === 0) return
    void Promise.all(Array.from(missing).slice(0, 25).map((id) => fetchUsernameByUserId(id)))
  }, [fetchUsernameByUserId, items, ready, usernamesById])

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
  }, [authLoading, isAuthenticated, load, loadingRole, loadingWorkspaces, workspaceId])

  const onAdd = useCallback(async () => {
    if (!ready) return
    if (!canManage) {
      toast.error("You do not have permission to manage members")
      return
    }

    const uid = userId.trim()
    if (!uid) return

    if (role === "OWNER" && !canSetOwner) {
      toast.error("Only OWNER can assign OWNER")
      return
    }

    setAdding(true)
    try {
      const created = await apiFetchJson<Member>(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, role }),
      })

      const normalized = normalizeMember(created)
      setItems((prev) => [normalized, ...prev])
      const key = toUserKey(normalized)
      if (key && normalized.username) {
        setUsernamesById((prev) => ({ ...prev, [key]: normalized.username! }))
      } else if (key) {
        void fetchUsernameByUserId(key)
      }
      setUserId("")
      setRole("VIEWER")
      toast.success("Member added")
    } catch (e) {
      const handled = handleApiError(e)
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Add failed")
    } finally {
      setAdding(false)
    }
  }, [canManage, canSetOwner, ready, role, userId, workspaceId])

  const updateRole = useCallback(
    async (member: Member, nextRole: string) => {
      if (!ready) return
      if (!canManage) {
        toast.error("You do not have permission to manage members")
        return
      }
      if (nextRole === "OWNER" && !canSetOwner) {
        toast.error("Only OWNER can assign OWNER")
        return
      }
      if (String(member.role).toUpperCase() === "OWNER" && !canSetOwner) {
        toast.error("Only OWNER can change OWNER")
        return
      }

      const key = member.id ?? member.user_id
      if (key === undefined || key === null) {
        toast.error("Member id missing")
        return
      }

      // Try common patterns without changing backend contracts.
      // Prefer user_id first (some APIs use user_id in the path).
      const tryPaths = [
        `/workspaces/${workspaceId}/members/${member.user_id ?? key}`,
        `/workspaces/${workspaceId}/members/${key}`,
      ]

      let updated: Member | null = null
      let lastErr: string | null = null

      const bodyForMember = JSON.stringify({ role: nextRole, user_id: member.user_id })
      const bodyForCollection = JSON.stringify({ user_id: member.user_id ?? key, role: nextRole })

      for (const path of tryPaths) {
        for (const method of ["PATCH", "PUT"] as const) {
          try {
            updated = await apiFetchJson<Member>(path, {
              method,
              auth: true,
              headers: { "Content-Type": "application/json" },
              body: bodyForMember,
            })
            lastErr = null
            break
          } catch (e) {
            if (e instanceof ApiError) {
              // Auth and permission errors should be surfaced immediately.
              if (e.status === 401 || e.status === 403) {
                handleApiError(e)
                return
              }

              // 404/405 are expected during probing different endpoints/methods.
              if (e.status === 404 || e.status === 405) {
                lastErr = null
                continue
              }

              lastErr = e.message
              continue
            }

            lastErr = e instanceof Error ? e.message : "Update failed"
          }
        }

        if (updated) break
      }

      if (!updated) {
        // Fallback: some APIs update via collection route
        for (const method of ["PATCH", "PUT"] as const) {
          try {
            updated = await apiFetchJson<Member>(`/workspaces/${workspaceId}/members`, {
              method,
              auth: true,
              headers: { "Content-Type": "application/json" },
              body: bodyForCollection,
            })
            lastErr = null
            break
          } catch (e) {
            if (e instanceof ApiError) {
              if (e.status === 401 || e.status === 403) {
                handleApiError(e)
                return
              }
              if (e.status === 404 || e.status === 405) {
                lastErr = null
                continue
              }
              lastErr = e.message
              continue
            }

            lastErr = e instanceof Error ? e.message : "Update failed"
          }
        }
      }

      if (!updated) {
        toast.error(lastErr ?? "Role update is not supported by the server")
        return
      }

      setItems((prev) =>
        prev.map((m) => {
          const mKey = m.id ?? m.user_id
          return normalizeId(mKey) === normalizeId(key) ? { ...m, role: updated!.role ?? nextRole } : m
        }),
      )
      toast.success("Role updated")
    },
    [canManage, canSetOwner, ready, workspaceId],
  )

  const removeMember = useCallback(
    async (member: Member) => {
      if (!ready) return
      if (!canManage) {
        toast.error("You do not have permission to manage members")
        return
      }
      if (String(member.role).toUpperCase() === "OWNER" && !canSetOwner) {
        toast.error("Only OWNER can remove OWNER")
        return
      }

      const key = member.id ?? member.user_id
      if (key === undefined || key === null) {
        toast.error("Member id missing")
        return
      }

      // Confirmation handled via AlertDialog

      const tryPaths = [
        `/workspaces/${workspaceId}/members/${key}`,
        `/workspaces/${workspaceId}/members/${member.user_id ?? key}`,
      ]

      for (const path of tryPaths) {
        try {
          const res = await apiFetch(path, { method: "DELETE", auth: true })
          if (!res.ok) {
            const body = await res.text().catch(() => "")
            throw new ApiError(extractErrorMessage(res.status, body), res.status, body)
          }

          setItems((prev) =>
            prev.filter((m) => normalizeId(m.id ?? m.user_id) !== normalizeId(key)),
          )
          toast.success("Removed")
          return
        } catch (e) {
          const handled = handleApiError(e)
          if (handled.kind === "unauthorized") return
          // try next
        }
      }

      toast.error("Remove failed")
    },
    [canManage, canSetOwner, ready, workspaceId],
  )

  const requestRemove = useCallback(
    (member: Member) => {
      if (!ready) return
      if (!canManage) {
        toast.error("You do not have permission to manage members")
        return
      }
      if (String(member.role).toUpperCase() === "OWNER" && !canSetOwner) {
        toast.error("Only OWNER can remove OWNER")
        return
      }

      setRemoveTarget(member)
      setRemoveOpen(true)
    },
    [canManage, canSetOwner, ready],
  )

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await removeMember(removeTarget)
      setRemoveOpen(false)
      setRemoveTarget(null)
    } finally {
      setRemoving(false)
    }
  }, [removeMember, removeTarget])

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ar = String(a.role ?? "").toUpperCase()
      const br = String(b.role ?? "").toUpperCase()
      return ar.localeCompare(br)
    })
  }, [items])

  return (
    <div className="container mx-auto p-6">
      <AlertDialog
        open={removeOpen}
        onOpenChange={(open) => {
          if (removing) return
          setRemoveOpen(open)
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the member from the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing} style={{ borderRadius: 12 }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={() => void confirmRemove()}
              style={{ borderRadius: 12 }}
              className="border border-red-500 bg-transparent text-red-600 hover:bg-red-50 hover:text-red-600 dark:border-red-500/60 dark:hover:bg-red-950/20"
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Members
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage workspace membership and roles.
        </p>
      </div>

      {!canManage && (
        <Card className="mt-6" style={{ borderRadius: 16 }}>
          <CardContent className="py-6 text-sm text-muted-foreground">
            You do not have access to member management in this workspace.
          </CardContent>
        </Card>
      )}

      <Card className="mt-6" style={{ borderRadius: 16 }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add member
          </CardTitle>
          <CardDescription>Requires OWNER/ADMIN. Assign OWNER requires OWNER.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID"
            style={{ borderRadius: 12 }}
            disabled={!canManage}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" style={{ borderRadius: 12 }} disabled={!canManage}>
                <Shield className="h-4 w-4" /> {role}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="w-48">
              {ROLE_OPTIONS.map((r) => {
                const disabled = r === "OWNER" && !canSetOwner
                return (
                  <DropdownMenuItem
                    key={r}
                    disabled={disabled}
                    onClick={() => setRole(r)}
                  >
                    {r}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              {!canSetOwner && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Only OWNER can assign OWNER.
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() => void onAdd()}
            disabled={!canManage || !userId.trim() || adding}
            className="bg-[#6F26D4] text-white hover:bg-[#6F26D4]/90"
            style={{ borderRadius: 12 }}
          >
            Add
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6" style={{ borderRadius: 16 }}>
        <CardHeader>
          <CardTitle className="text-base">Current members</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">No members found.</div>
          ) : (
            <div className="grid gap-2">
              {sorted.map((m) => {
                const key = m.id ?? m.user_id
                const mRole = String(m.role ?? "VIEWER").toUpperCase()
                const ownerLocked = mRole === "OWNER" && !canSetOwner

                return (
                  <div
                    key={String(key)}
                    className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderRadius: 14 }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {m.username ?? usernamesById[toUserKey(m)] ?? m.email ?? "User"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={!canManage || ownerLocked}
                            style={{ borderRadius: 12 }}
                          >
                            <Shield className="h-4 w-4" /> {mRole}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                          {ROLE_OPTIONS.map((r) => {
                            const disabled =
                              (!canSetOwner && (r === "OWNER" || mRole === "OWNER")) ||
                              (!canManage)
                            return (
                              <DropdownMenuItem
                                key={r}
                                disabled={disabled}
                                onClick={() => void updateRole(m, r)}
                              >
                                {r}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="outline"
                        disabled={!canManage || ownerLocked}
                        onClick={() => requestRemove(m)}
                        style={{ borderRadius: 12 }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
