"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { useWorkspace } from "@/lib/workspace-context"

export default function WorkspaceRequired() {
  const router = useRouter()
  const pathname = usePathname()
  const { loading: authLoading, isAuthenticated } = useAuth()
  const { workspaceId } = useWorkspace()

  useEffect(() => {
    // Allow dashboard without selection
    if (pathname === "/dashboard") return

    if (authLoading || !isAuthenticated) return

    if (!workspaceId) {
      router.push("/dashboard")
    }
  }, [authLoading, isAuthenticated, pathname, router, workspaceId])

  return null
}
