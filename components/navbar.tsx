'use client'

import { useCallback } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Navbar as ResizableNavbar, NavbarButton } from "@/components/ui/resizable-navbar"

const navItems = [
  { name: "Dashboard", link: "/dashboard" },
  { name: "Videos", link: "/videos" },
  { name: "Audios", link: "/audios" },
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
    <div className="flex h-full flex-col border-r bg-card/80 px-4 py-6 backdrop-blur">
      <Link
        href="/dashboard"
        className="mb-8 flex items-center gap-2 text-lg font-semibold text-primary"
      >
        ACC
      </Link>

      <nav className="flex flex-1 flex-col gap-2 text-sm font-medium text-foreground">
        {navItems.map((item) => {
          const isActive = pathname === item.link
          return (
            <Link
              key={item.link}
              href={item.link}
              className={`rounded-md px-3 py-2 transition hover:bg-muted ${isActive ? "bg-muted text-primary" : ""}`}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>

      <NavbarButton
        as="button"
        onClick={handleLogout}
        variant="dark"
        className="w-full text-left"
      >
        Logout
      </NavbarButton>
    </div>
  )

  return (
    <ResizableNavbar className="sticky left-0 top-0 h-screen w-64">
      <SidebarContent />
    </ResizableNavbar>
  )
}
