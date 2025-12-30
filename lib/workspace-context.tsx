"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  apiFetchJson,
  clearWorkspaceId,
  getAuthUserId,
  getWorkspaceIdNumber,
  setWorkspaceId,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

export type Workspace = {
  id: number | string
  name: string
  created_at?: string
}

type Member = {
  id?: number | string
  user_id?: number | string
  role?: string
  username?: string
  email?: string
  avatar_url?: string | null
}

type WorkspaceContextValue = {
  workspaces: Workspace[]
  loadingWorkspaces: boolean
  workspacesError: string | null
  refreshWorkspaces: () => Promise<void>

  workspaceId: number | null
  selectWorkspace: (id: string | number | null) => void

  role: string | null
  currentUserRole: string | null
  loadingRole: boolean
  roleError: string | null
  refreshRole: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

async function fetchWorkspaces(): Promise<Workspace[]> {
  return apiFetchJson<Workspace[]>("/workspaces", { method: "GET", auth: true })
}

async function fetchMembers(workspaceId: string): Promise<Member[]> {
  return apiFetchJson<Member[]>(`/workspaces/${workspaceId}/members`, {
    method: "GET",
    auth: true,
  })
}

function normalizeId(value: unknown): string {
  return String(value ?? "")
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { loading: authLoading, isAuthenticated } = useAuth()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
  const [workspacesError, setWorkspacesError] = useState<string | null>(null)

  const [workspaceId, setWorkspaceIdState] = useState<number | null>(null)

  const [role, setRole] = useState<string | null>(null)
  const [loadingRole, setLoadingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)

  const refreshWorkspaces = useCallback(async () => {
    if (authLoading || !isAuthenticated) return
    setLoadingWorkspaces(true)
    setWorkspacesError(null)
    try {
      const data = await fetchWorkspaces()
      setWorkspaces(data)
    } catch (e) {
      setWorkspacesError(e instanceof Error ? e.message : "Failed to load workspaces")
    } finally {
      setLoadingWorkspaces(false)
    }
  }, [authLoading, isAuthenticated])

  const refreshRole = useCallback(async () => {
    if (authLoading || !isAuthenticated) return

    const ws = getWorkspaceIdNumber()
    setWorkspaceIdState(ws)

    if (!ws) {
      setRole(null)
      setRoleError(null)
      setLoadingRole(false)
      return
    }

    setLoadingRole(true)
    setRoleError(null)
    try {
      const members = await fetchMembers(String(ws))
      const me = getAuthUserId()
      if (!me) {
        setRole(null)
        return
      }

      const found = members.find((m) => {
        const userId = m.user_id ?? (m as unknown as { userId?: unknown }).userId
        return normalizeId(userId) === normalizeId(me)
      })

      setRole(found?.role ? String(found.role) : null)
    } catch {
      // If we can't fetch role, default to least privilege in UI
      setRole(null)
      setRoleError("Unable to load role")
    } finally {
      setLoadingRole(false)
    }
  }, [authLoading, isAuthenticated])

  const selectWorkspace = useCallback((id: string | number | null) => {
    if (id === null) {
      clearWorkspaceId()
      setWorkspaceIdState(null)
      setRole(null)
      setRoleError(null)
      return
    }
    const n = Number(id)
    if (!Number.isFinite(n)) return
    setWorkspaceId(n)
    setWorkspaceIdState(n)
    window.dispatchEvent(new Event("workspaceChange"))
  }, [])

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      setWorkspaces([])
      setWorkspaceIdState(null)
      setRole(null)
      setWorkspacesError(null)
      setRoleError(null)
      setLoadingWorkspaces(false)
      setLoadingRole(false)
      return
    }

    setWorkspaceIdState(getWorkspaceIdNumber())
    void refreshWorkspaces()
    void refreshRole()

    const onStorage = () => {
      if (authLoading || !isAuthenticated) return
      setWorkspaceIdState(getWorkspaceIdNumber())
      void refreshRole()
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener("workspaceChange", onStorage)

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("workspaceChange", onStorage)
    }
  }, [authLoading, isAuthenticated, refreshRole, refreshWorkspaces])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      loadingWorkspaces,
      workspacesError,
      refreshWorkspaces,
      workspaceId,
      selectWorkspace,
      role,
      currentUserRole: role,
      loadingRole,
      roleError,
      refreshRole,
    }),
    [
      workspaces,
      loadingWorkspaces,
      workspacesError,
      refreshWorkspaces,
      workspaceId,
      selectWorkspace,
      role,
      loadingRole,
      roleError,
      refreshRole,
    ],
  )

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}
