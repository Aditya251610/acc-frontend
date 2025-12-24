'use client'

import { useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, LayoutDashboard, Video, Music, UploadCloud, FileText, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Navbar as ResizableNavbar } from "@/components/ui/resizable-navbar"
import WorkspaceSwitcher from "@/components/workspace-switcher"
import { useWorkspace } from "@/lib/workspace-context"
import { canEditContent, canManageMembers } from "@/lib/rbac"
import { useAuth } from "@/lib/auth-context"

type NavItem = {
  name: string
  link: string
  Icon: typeof LayoutDashboard
  requiresEdit?: boolean
  requiresMembers?: boolean
}

const baseNavItems: NavItem[] = [
  { name: "Dashboard", link: "/dashboard", Icon: LayoutDashboard },
  { name: "Videos", link: "/videos", Icon: Video },
  { name: "Audios", link: "/audios", Icon: Music },
  { name: "Documents", link: "/documents", Icon: FileText },
  { name: "Upload", link: "/upload", Icon: UploadCloud, requiresEdit: true },
  { name: "Members", link: "/members", Icon: Users, requiresMembers: true },
]

function SidebarContent({
  pathname,
  onLogout,
  visible,
}: {
  pathname: string | null
  onLogout: () => void
  visible?: boolean
}) {
  const { role, workspaceId } = useWorkspace()
  const canUpload = canEditContent(role)
  const canMembers = canManageMembers(role)

  const navItems = baseNavItems.filter((item) => {
    if (item.requiresEdit) return canUpload
    if (item.requiresMembers) return canMembers
    return true
  })

  return (
    <div
      style={{ borderRadius: '0 1rem 1rem 0' }}
      className={cn(
        "flex h-full flex-col border-r px-4 py-6 backdrop-blur transition-all duration-300",
        visible ? "bg-card/90 shadow-xl" : "bg-card/70",
      )}
    >
      <Link
        href="/dashboard"
        className="mb-8 flex items-center gap-2 px-3 text-lg font-bold text-primary"
      >
        <Image src="/acc_logo.png" alt="ACC" width={144} height={36} className="h-9 w-auto" priority />
      </Link>

      <div className="px-3">
        <WorkspaceSwitcher />
        <div className="mt-2 text-xs text-muted-foreground">
          {workspaceId ? (
            <span>
              Role: <span className="text-foreground">{role ?? "Unknown"}</span>
            </span>
          ) : (
            <span>Select a workspace</span>
          )}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2 text-sm font-medium text-foreground">
        {navItems.map(({ name, link, Icon }) => {
          const isActive = pathname === link
          return (
            <Link
              key={link}
              href={link}
              style={{ borderRadius: '0.6rem' }}
              className={cn(
                "flex items-center gap-3 px-3 py-3 transition transform",
                "hover:scale-[1.02] hover:-translate-y-[1px] hover:shadow-sm hover:bg-primary/10 hover:text-primary",
                isActive ? "bg-primary/10 text-primary" : "text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{name}</span>
            </Link>
          )
        })}
      </nav>

      <button
        onClick={onLogout}
        style={{ borderRadius: '0.5rem' }}
        className="mt-2 flex w-full items-center justify-between gap-2 border border-gray-200 px-3 py-2 text-sm font-medium text-foreground transition hover:border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:hover:bg-red-950/20"
      >
        <span>Logout</span>
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  return (
    <ResizableNavbar className="sticky left-0 top-0 h-screen w-64">
      <SidebarContent pathname={pathname} onLogout={handleLogout} />
    </ResizableNavbar>
  )
}
