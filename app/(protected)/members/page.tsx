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
import { ApiError, apiFetchJson } from "@/lib/api"
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

function toUserKey(member: Member) {
  const key = member.user_id ?? member.id
  return String(key ?? "").trim()
}

function normalizeMember(raw: unknown): Member {
  const m = raw as Record<string, unknown>

  // Backend source of truth now returns username/email directly.
  const id = m?.id as Member["id"]
  const user_id = m?.user_id as Member["user_id"]
  const role = m?.role as Member["role"]
  const username = m?.username as Member["username"]
  const email = m?.email as Member["email"]

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
      const payload = await apiFetchJson<Member[]>(`/workspaces/${workspaceId}/members`, {
        method: "GET",
        auth: true,
      })

      setItems(Array.isArray(payload) ? payload.map(normalizeMember) : [])
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

      const targetUserId = member.user_id
      if (targetUserId === undefined || targetUserId === null) {
        toast.error("Member user_id missing")
        return
      }

      let updated: Member
      try {
        updated = await apiFetchJson<Member>(
          `/workspaces/${workspaceId}/members/${targetUserId}`,
          {
            method: "PATCH",
            auth: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: targetUserId, role: nextRole }),
          },
        )
      } catch (e) {
        const handled = handleApiError(e)
        if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Update failed")
        return
      }

      setItems((prev) =>
        prev.map((m) => {
          return normalizeId(m.user_id) === normalizeId(targetUserId)
            ? normalizeMember({ ...m, ...updated })
            : m
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

      const targetUserId = member.user_id
      if (targetUserId === undefined || targetUserId === null) {
        toast.error("Member user_id missing")
        return
      }

      try {
        await apiFetchJson<{ detail: string }>(
          `/workspaces/${workspaceId}/members/${targetUserId}`,
          { method: "DELETE", auth: true },
        )
        setItems((prev) => prev.filter((m) => normalizeId(m.user_id) !== normalizeId(targetUserId)))
        toast.success("Removed")
      } catch (e) {
        const handled = handleApiError(e)
        if (!handled.handled) toast.error(e instanceof ApiError ? e.message : "Remove failed")
      }
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
    <div className="container mx-auto">
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
                        {m.username ?? m.email ?? (toUserKey(m) ? `User #${toUserKey(m)}` : "User")}
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
