'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Navbar from "@/components/navbar"
import { WorkspaceProvider } from "@/lib/workspace-context"
import WorkspaceRequired from "@/components/workspace-required"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, loading, router])

  if (loading || !isAuthenticated) {
    return null
  }

  return (
    <WorkspaceProvider>
      <WorkspaceRequired />
      <div className="relative z-10 flex h-dvh bg-background overflow-hidden">
        <div className="shrink-0">
          <Navbar />
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto p-6">{children}</main>
      </div>
    </WorkspaceProvider>
  )
}
