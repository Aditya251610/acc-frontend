'use client'

import { useCallback } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Navbar as ResizableNavbar, NavbarButton } from "@/components/ui/resizable-navbar"

const navItems = [
  { name: "Dashboard", link: "/dashboard" },
  { name: "Videos", link: "/videos" },
  { name: "Audios", link: "/audios" },
  { name: "Upload", link: "/upload" },
]

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = useCallback(() => {
    localStorage.removeItem("authToken")
    window.dispatchEvent(new Event("authChange"))
    router.push("/login")
  }, [router])

  const SidebarContent = ({ visible }: { visible?: boolean }) => (
    <div
      style={{ borderRadius: '0 1rem 1rem 0' }}
      className={cn(
        "flex h-full flex-col border-r px-4 py-6 backdrop-blur transition-all duration-300",
        visible ? "bg-card/90 shadow-xl" : "bg-card/70",
      )}
    >
      <Link
        href="/dashboard"
        className="mb-8 flex items-center gap-2 text-lg font-semibold text-primary"
      >
        <img src="/acc_logo.png" alt="ACC" className="h-8 w-auto" />
      </Link>

      <nav className="flex flex-1 flex-col gap-1 text-sm font-medium text-foreground">
        {navItems.map((item) => {
          const isActive = pathname === item.link
          return (
            <Link
              key={item.link}
              href={item.link}
              style={{ borderRadius: '0.5rem' }}
              className={cn(
                "px-3 py-2 transition hover:bg-muted",
                isActive && "bg-muted text-primary",
              )}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={handleLogout}
        style={{ borderRadius: '0.5rem' }}
        className="mt-2 flex w-full items-center justify-between gap-2 border border-gray-200 px-3 py-2 text-sm font-medium text-foreground transition hover:border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:hover:bg-red-950/20"
      >
        <span>Logout</span>
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <ResizableNavbar className="sticky left-0 top-0 h-screen w-64">
      <SidebarContent />
    </ResizableNavbar>
  )
}
