'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Navbar from "@/components/navbar"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!loading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, loading, router])

  // Show nothing while checking auth or if not authenticated
  if (loading || !isAuthenticated) {
    return null
  }

  return (
    <div className="relative z-10 flex min-h-screen bg-background">
      <Navbar />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
