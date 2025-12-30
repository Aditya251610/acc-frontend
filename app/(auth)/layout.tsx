'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import PublicNavbar from "@/components/public-navbar"
import { LoaderThree } from "@/components/ui/loader"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (!loading && isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, loading, router])

  // Show nothing while checking auth or if already authenticated
  if (loading || isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <LoaderThree />
      </div>
    )
  }

  return (
    <>
      <div className="relative z-20">
        <PublicNavbar />
      </div>
      <main className="min-h-screen flex items-center justify-center">
        {children}
      </main>
    </>
  )
}
