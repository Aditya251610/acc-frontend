'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Navbar from "@/components/navbar"
import { WorkspaceProvider } from "@/lib/workspace-context"
import WorkspaceRequired from "@/components/workspace-required"
import { LoaderThree } from "@/components/ui/loader"

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
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <LoaderThree />
      </div>
    )
  }

  return (
    <WorkspaceProvider>
      <WorkspaceRequired />
      <div className="relative z-10 flex h-dvh flex-col bg-background overflow-hidden md:flex-row">
        <div className="w-full shrink-0 md:w-auto">
          <Navbar />
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto p-4">{children}</main>
      </div>
    </WorkspaceProvider>
  )
}
