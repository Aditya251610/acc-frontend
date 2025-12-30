'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, LayoutDashboard, Video, Music, UploadCloud, FileText, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "motion/react"
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import WorkspaceSwitcher from "@/components/workspace-switcher"
import { useWorkspace } from "@/lib/workspace-context"
import { canEditContent, canManageMembers } from "@/lib/rbac"
import { useAuth } from "@/lib/auth-context"
import { getMyProfile, type MyProfile } from "@/lib/api"
import { getCachedMediaUrl, getOrFetchMediaUrl } from "@/lib/media-cache"
import { handleApiError } from "@/lib/handle-api-error"

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

function parseAvatarMediaRef(value: string | null | undefined): { workspaceId: string; mediaId: string } | null {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return null

  // media:<workspaceId>:<mediaId>
  if (trimmed.startsWith("media:")) {
    const parts = trimmed.split(":")
    if (parts.length !== 3) return null
    const workspaceId = parts[1]
    const mediaId = parts[2]
    if (!workspaceId || !mediaId) return null
    return { workspaceId, mediaId }
  }

  // /workspaces/<workspaceId>/media/<mediaId>/download (relative or absolute)
  const m = trimmed.match(/\/workspaces\/([^/]+)\/media\/([^/]+)\/download\b/)
  if (!m) return null
  const workspaceId = m[1]
  const mediaId = m[2]
  if (!workspaceId || !mediaId) return null
  return { workspaceId, mediaId }
}

function getInitials(profile: MyProfile | null): string {
  const first = String(profile?.first_name ?? "").trim()
  const last = String(profile?.last_name ?? "").trim()
  const username = String(profile?.username ?? "").trim()

  const a = first ? first[0] : ""
  const b = last ? last[0] : ""
  const c = username ? username[0] : ""

  const two = `${a}${b}`.trim()
  if (two) return two.toUpperCase()
  if (c) return c.toUpperCase()
  return "U"
}

function SidebarProfileMenu({ profile, onLogout }: { profile: MyProfile | null; onLogout: () => void }) {
  const { open, animate } = useSidebar()
  const router = useRouter()

  const avatarUrlRaw = String(profile?.avatar_url ?? "").trim() || null
  const [avatarResolvedUrl, setAvatarResolvedUrl] = useState<string | null>(null)

  useEffect(() => {
    const ref = parseAvatarMediaRef(avatarUrlRaw)
    let cancelled = false

    // Clear any previous resolved media URL when avatar changes.
    queueMicrotask(() => {
      if (!cancelled) setAvatarResolvedUrl(null)
    })

    if (!ref) {
      return () => {
        cancelled = true
      }
    }

    const cached = getCachedMediaUrl(ref.workspaceId, ref.mediaId)
    if (cached) {
      queueMicrotask(() => {
        if (!cancelled) setAvatarResolvedUrl(cached)
      })
      return () => {
        cancelled = true
      }
    }

    void getOrFetchMediaUrl(ref.workspaceId, ref.mediaId)
      .then((url) => {
        if (!cancelled) setAvatarResolvedUrl(url)
      })
      .catch(() => {
        // ignore
      })

    return () => {
      cancelled = true
    }
  }, [avatarUrlRaw])

  const fullName = useMemo(() => {
    const a = String(profile?.first_name ?? "").trim()
    const b = String(profile?.last_name ?? "").trim()
    const joined = `${a} ${b}`.trim()
    return joined || "—"
  }, [profile?.first_name, profile?.last_name])

  const username = String(profile?.username ?? "").trim() || ""
  const isMediaRef = !!parseAvatarMediaRef(avatarUrlRaw)
  const effectiveAvatarUrl = avatarResolvedUrl ?? (!isMediaRef ? avatarUrlRaw : null)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "mt-4 flex w-full items-center rounded-xl py-2",
            open ? "justify-start gap-3 px-2" : "justify-center px-0",
            "text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-200 dark:hover:bg-neutral-700/50",
          )}
          style={{ borderRadius: 14 }}
        >
          <div
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border bg-muted"
            style={{ borderRadius: 9999 }}
          >
            {effectiveAvatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={effectiveAvatarUrl} alt="Avatar" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                {getInitials(profile)}
              </div>
            )}
          </div>

          <motion.div
            animate={{
              display: animate ? (open ? "block" : "none") : "block",
              opacity: animate ? (open ? 1 : 0) : 1,
            }}
            className="min-w-0 text-left"
          >
            <div className="truncate text-sm font-medium text-foreground">{fullName}</div>
            <div className="truncate text-xs text-muted-foreground">{username ? `@${username}` : ""}</div>
          </motion.div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuItem onSelect={() => router.push("/profile")} className="gap-3">
          <div
            className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border bg-muted"
            style={{ borderRadius: 9999 }}
          >
            {effectiveAvatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={effectiveAvatarUrl} alt="Avatar" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                {getInitials(profile)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{fullName}</div>
            <div className="truncate text-xs text-muted-foreground">{username ? `@${username}` : ""}</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={onLogout}
          className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarContent({
  pathname,
  onLogout,
}: {
  pathname: string | null
  onLogout: () => void
}) {
  const { open } = useSidebar()
  const { role, workspaceId } = useWorkspace()
  const { loading: authLoading, isAuthenticated } = useAuth()
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const canUpload = canEditContent(role)
  const canMembers = canManageMembers(role)

  const navItems = baseNavItems.filter((item) => {
    if (item.requiresEdit) return canUpload
    if (item.requiresMembers) return canMembers
    return true
  })

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      queueMicrotask(() => setProfile(null))
      return
    }

    let cancelled = false
    void getMyProfile()
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch((e) => {
        const handled = handleApiError(e)
        if (handled.kind === "unauthorized") return
        setProfile(null)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated])

  return (
    <SidebarBody className={cn("h-full", open ? "px-4" : "px-2")}> 
      <div className="flex h-full flex-col">
        <div className="mb-4">
          <div className={cn("flex items-center", open ? "justify-start gap-3" : "justify-center")}> 
            <Image
              src="/acc_logo.png"
              alt="ACC"
              width={144}
              height={36}
              className={cn("w-auto object-contain", open ? "h-9" : "h-8")}
              priority
            />
          </div>

          <div className={cn("mt-4", open ? "space-y-2" : "flex items-center justify-center")}> 
            <WorkspaceSwitcher compact={!open} className={cn(!open && "h-10 w-10")} />

            {open && (
              <div className="text-xs text-muted-foreground">
                {workspaceId ? (
                  <span className="flex items-center gap-2">
                    <span>Role</span>
                    <span
                      className="inline-flex items-center border bg-background px-2 py-0.5 text-foreground"
                      style={{ borderRadius: 12 }}
                    >
                      {role ?? "Unknown"}
                    </span>
                  </span>
                ) : (
                  <span>Select a workspace</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-1">
          {navItems.map(({ name, link, Icon }) => {
            const isActive = pathname === link
            return (
              <SidebarLink
                key={link}
                link={{
                  label: name,
                  href: link,
                  icon: (
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isActive
                          ? "text-neutral-900 dark:text-white"
                          : "text-neutral-700 dark:text-neutral-200",
                      )}
                    />
                  ),
                }}
                style={{ borderRadius: 14 }}
                className={cn(
                  "px-2 py-2 transition-colors",
                  isActive
                    ? "bg-neutral-200 dark:bg-neutral-700"
                    : "hover:bg-neutral-200/70 dark:hover:bg-neutral-700/50",
                )}
              />
            )
          })}
        </div>

        <SidebarProfileMenu profile={profile} onLogout={onLogout} />
      </div>
    </SidebarBody>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  return (
    <Sidebar>
      <SidebarContent pathname={pathname} onLogout={handleLogout} />
    </Sidebar>
  )
}
