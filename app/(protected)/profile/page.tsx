
'use client'

import { Upload } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  apiFetch,
  apiFetchJson,
  ApiError,
  extractErrorMessage,
  getMyProfile,
  type MyProfile,
  updateMyProfile,
  type UpdateMyProfilePayload,
} from '@/lib/api'
import { handleApiError } from '@/lib/handle-api-error'
import { useAuth } from '@/lib/auth-context'
import { useWorkspace } from '@/lib/workspace-context'
import { getCachedMediaUrl, getOrFetchMediaUrl } from '@/lib/media-cache'

type MemberRow = {
  id?: number | string
  user_id?: number | string
  role?: string | null
  username?: string | null
  email?: string | null
}

type WorkspaceRoleInfo = {
  workspaceId: string
  role: string | null
}

function normalizeId(value: unknown): string {
  return String(value ?? '')
}

function getInitials(profile: MyProfile | null): string {
  const first = String(profile?.first_name ?? '').trim()
  const last = String(profile?.last_name ?? '').trim()
  const username = String(profile?.username ?? '').trim()

  const a = first ? first[0] : ''
  const b = last ? last[0] : ''
  const c = username ? username[0] : ''

  const two = `${a}${b}`.trim()
  if (two) return two.toUpperCase()
  if (c) return c.toUpperCase()
  return 'U'
}

function asDateInputValue(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  // backend returns ISO date (YYYY-MM-DD). Accept also ISO datetime by slicing.
  return String(isoDate).slice(0, 10)
}

function parseAvatarMediaRef(value: string | null): { workspaceId: string; mediaId: string } | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null

  // media:<workspaceId>:<mediaId>
  if (trimmed.startsWith('media:')) {
    const parts = trimmed.split(':')
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

async function resolveWorkspaceRolesForUser(opts: {
  userId: string | null
  recent: NonNullable<MyProfile['recent_workspaces']>
}): Promise<WorkspaceRoleInfo[]> {
  const { userId, recent } = opts
  if (!userId) return recent.map((w) => ({ workspaceId: normalizeId(w.id), role: w.role ?? null }))

  const parseMembers = (payload: unknown): MemberRow[] => {
    if (Array.isArray(payload)) return payload as MemberRow[]
    const items = (payload as { items?: unknown })?.items
    if (Array.isArray(items)) return items as MemberRow[]
    return []
  }

  const results = await Promise.allSettled(
    recent.map(async (w) => {
      const wsId = normalizeId(w.id)
      if (w.role) return { workspaceId: wsId, role: String(w.role) }

      try {
        const payload = await apiFetchJson<unknown>(`/workspaces/${wsId}/members`, {
          method: 'GET',
          auth: true,
        })
        const members = parseMembers(payload)
        const found = members.find((m) => normalizeId(m.user_id ?? m.id) === normalizeId(userId))
        return { workspaceId: wsId, role: found?.role ? String(found.role) : null }
      } catch {
        return { workspaceId: wsId, role: null }
      }
    }),
  )

  return results.map((r, idx) => {
    if (r.status === 'fulfilled') return r.value
    const wsId = normalizeId(recent[idx]?.id)
    return { workspaceId: wsId, role: recent[idx]?.role ?? null }
  })
}

export default function ProfilePage() {
  const { userId, loading: authLoading, isAuthenticated } = useAuth()
  const { workspaceId } = useWorkspace()

  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const avatarInputId = useId()
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarMediaUrl, setAvatarMediaUrl] = useState<string | null>(null)

  const [form, setForm] = useState<{
    first_name: string
    last_name: string
    username: string
    date_of_birth: string
    bio: string
  }>(() => ({
    first_name: '',
    last_name: '',
    username: '',
    date_of_birth: '',
    bio: '',
  }))

  const [workspaceRoles, setWorkspaceRoles] = useState<Record<string, string | null>>({})

  const ready = !authLoading && isAuthenticated

  const recentWorkspaces = useMemo(() => profile?.recent_workspaces ?? [], [profile?.recent_workspaces])

  const load = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    setError(null)

    try {
      const p = await getMyProfile()
      setProfile(p)
      setForm({
        first_name: String(p.first_name ?? ''),
        last_name: String(p.last_name ?? ''),
        username: String(p.username ?? ''),
        date_of_birth: asDateInputValue(p.date_of_birth),
        bio: String(p.bio ?? ''),
      })

      // Reset any local avatar preview on reload.
      if (avatarPreviewUrl) {
        try {
          URL.revokeObjectURL(avatarPreviewUrl)
        } catch {
          // ignore
        }
      }
      setAvatarPreviewUrl(null)

      if ((p.recent_workspaces ?? []).length > 0) {
        const rolePairs = await resolveWorkspaceRolesForUser({
          userId,
          recent: p.recent_workspaces ?? [],
        })
        const map: Record<string, string | null> = {}
        for (const r of rolePairs) map[r.workspaceId] = r.role
        setWorkspaceRoles(map)
      } else {
        setWorkspaceRoles({})
      }
    } catch (e) {
      const handled = handleApiError(e)
      if (handled.kind === 'unauthorized') return
      setProfile(null)
      setError(e instanceof Error ? e.message : 'Failed to load profile')
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [avatarPreviewUrl, ready, userId])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setProfile(null)
      setLoading(false)
      return
    }
    void load()
  }, [authLoading, isAuthenticated, load])

  const fullName = useMemo(() => {
    const a = String(profile?.first_name ?? '').trim()
    const b = String(profile?.last_name ?? '').trim()
    const joined = `${a} ${b}`.trim()
    return joined || '—'
  }, [profile?.first_name, profile?.last_name])

  const avatarUrl = useMemo(() => {
    const raw = String(profile?.avatar_url ?? '').trim()
    return raw || null
  }, [profile?.avatar_url])

  useEffect(() => {
    setAvatarMediaUrl(null)
    const ref = parseAvatarMediaRef(avatarUrl)
    if (!ref) return

    const cached = getCachedMediaUrl(ref.workspaceId, ref.mediaId)
    if (cached) {
      setAvatarMediaUrl(cached)
      return
    }

    let cancelled = false
    void getOrFetchMediaUrl(ref.workspaceId, ref.mediaId)
      .then((url) => {
        if (!cancelled) setAvatarMediaUrl(url)
      })
      .catch(() => {
        // ignore; avatar will fall back to initials
      })

    return () => {
      cancelled = true
    }
  }, [avatarUrl])

  const effectiveAvatarUrl = useMemo(() => {
    return avatarPreviewUrl ?? avatarMediaUrl ?? avatarUrl
  }, [avatarMediaUrl, avatarPreviewUrl, avatarUrl])

  const onCancel = useCallback(() => {
    if (!profile) return
    setIsEditing(false)
    setForm({
      first_name: String(profile.first_name ?? ''),
      last_name: String(profile.last_name ?? ''),
      username: String(profile.username ?? ''),
      date_of_birth: asDateInputValue(profile.date_of_birth),
      bio: String(profile.bio ?? ''),
    })
    if (avatarPreviewUrl) {
      try {
        URL.revokeObjectURL(avatarPreviewUrl)
      } catch {
        // ignore
      }
    }
    setAvatarPreviewUrl(null)
  }, [avatarPreviewUrl, profile])

  const onPickAvatarFile = useCallback(
    async (file: File | null) => {
      if (!ready) return
      if (!file) return
      if (uploadingAvatar) return

      const uploadWorkspaceId = workspaceId ?? profile?.recent_workspaces?.[0]?.id
      if (!uploadWorkspaceId) {
        toast.error('Select a workspace to upload a profile photo')
        return
      }

      if (avatarPreviewUrl) {
        try {
          URL.revokeObjectURL(avatarPreviewUrl)
        } catch {
          // ignore
        }
      }

      const url = URL.createObjectURL(file)
      setAvatarPreviewUrl(url)

      setUploadingAvatar(true)
      try {
        const form = new FormData()
        form.append('file', file)

        const uploadRes = await apiFetch(`/workspaces/${uploadWorkspaceId}/media/upload`, {
          method: 'POST',
          auth: true,
          body: form,
        })

        if (!uploadRes.ok) {
          const body = await uploadRes.text().catch(() => '')
          throw new ApiError(extractErrorMessage(uploadRes.status, body), uploadRes.status, body)
        }

        const payload = await uploadRes.json().catch(() => ({}))
        const asAny = payload as Record<string, unknown>
        const candidateId =
          asAny?.id ??
          asAny?.media_id ??
          (asAny?.item && typeof asAny.item === 'object' ? (asAny.item as Record<string, unknown>)?.id : undefined)

        if (candidateId === undefined || candidateId === null || String(candidateId).trim() === '') {
          toast.error('Upload succeeded, but backend did not return a media id')
          return
        }

        const ref = `media:${String(uploadWorkspaceId)}:${String(candidateId)}`
        const updated = await updateMyProfile({ avatar_url: ref })
        setProfile(updated)
        toast.success('Avatar updated')
      } catch (e) {
        const handled = handleApiError(e)
        if (!handled.handled) toast.error(e instanceof ApiError ? e.message : 'Avatar upload failed')
      } finally {
        setUploadingAvatar(false)
      }
    },
    [avatarPreviewUrl, profile?.recent_workspaces, ready, uploadingAvatar, workspaceId],
  )

  const onSave = useCallback(async () => {
    if (!profile) return
    if (!ready) return
    if (saving) return

    const payload: UpdateMyProfilePayload = {
      first_name: form.first_name.trim() || undefined,
      last_name: form.last_name.trim() || undefined,
      username: form.username.trim() || undefined,
      bio: form.bio.trim() || undefined,
      date_of_birth: form.date_of_birth.trim() || undefined,
    }

    // Only send keys the backend allows; drop undefined.
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === 'string' && v.trim()) cleaned[k] = v
    }

    setSaving(true)
    try {
      let updated: MyProfile | null = null

      // If there are other profile fields to update, patch them.
      if (Object.keys(cleaned).length > 0) {
        updated = await updateMyProfile(cleaned)
      }

      if (updated) {
        setProfile(updated)
        toast.success('Profile updated')
        // Refresh workspace roles if recent_workspaces changed.
        if ((updated.recent_workspaces ?? []).length > 0) {
          const rolePairs = await resolveWorkspaceRolesForUser({
            userId,
            recent: updated.recent_workspaces ?? [],
          })
          const map: Record<string, string | null> = {}
          for (const r of rolePairs) map[r.workspaceId] = r.role
          setWorkspaceRoles(map)
        }
      } else {
        toast.success('Nothing to update')
      }

      setIsEditing(false)
    } catch (e) {
      const handled = handleApiError(e)
      if (!handled.handled) toast.error(e instanceof ApiError ? e.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }, [form, profile, ready, saving, userId])

  if (loading) {
    return (
      <div className="container mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="h-[360px] animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-[360px] animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto">
        <Card style={{ borderRadius: 16 }}>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">{error}</div>
            <div>
              <Button variant="outline" onClick={() => void load()} style={{ borderRadius: 12 }}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto">
        <div className="text-sm text-muted-foreground">No profile data.</div>
      </div>
    )
  }

  const radiusCard = 16

  return (
    <div className="container mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and update your account details.
          </p>
        </div>

        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} style={{ borderRadius: 12 }}>
              Edit Profile
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel} disabled={saving} style={{ borderRadius: 12 }}>
                Cancel
              </Button>
              <Button onClick={() => void onSave()} disabled={saving} style={{ borderRadius: 12 }}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" style={{ borderRadius: radiusCard }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-4">
              {isEditing ? (
                <label
                  htmlFor={avatarInputId}
                  className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full border bg-muted"
                  style={{ borderRadius: 9999 }}
                  aria-label="Upload profile photo"
                >
                  <input
                    id={avatarInputId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={!ready || uploadingAvatar}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      void onPickAvatarFile(f)
                      // allow re-selecting the same file
                      e.currentTarget.value = ''
                    }}
                  />

                  {effectiveAvatarUrl ? (
                    // Use <img> to avoid next/image domain config.
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={effectiveAvatarUrl}
                      alt="Avatar"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {getInitials(profile)}
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Upload className="h-5 w-5 text-foreground" />
                  </div>
                </label>
              ) : (
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border bg-muted"
                  style={{ borderRadius: 9999 }}
                >
                  {effectiveAvatarUrl ? (
                    // Use <img> to avoid next/image domain config.
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={effectiveAvatarUrl}
                      alt="Avatar"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {getInitials(profile)}
                    </div>
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-sm text-muted-foreground">Full name</div>
                <div className="truncate text-lg font-semibold">{fullName}</div>
                <div className="mt-1 text-sm text-muted-foreground">@{profile.username}</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="text-sm text-muted-foreground">First name</div>
                <Input
                  value={isEditing ? form.first_name : String(profile.first_name ?? '')}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  disabled={!isEditing}
                  style={{ borderRadius: 12 }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="text-sm text-muted-foreground">Last name</div>
                <Input
                  value={isEditing ? form.last_name : String(profile.last_name ?? '')}
                  onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                  disabled={!isEditing}
                  style={{ borderRadius: 12 }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="text-sm text-muted-foreground">Username</div>
                <Input
                  value={isEditing ? form.username : profile.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  disabled={!isEditing}
                  style={{ borderRadius: 12 }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="text-sm text-muted-foreground">Email</div>
                <Input value={profile.email} disabled readOnly style={{ borderRadius: 12 }} />
              </div>

              <div className="space-y-1.5">
                <div className="text-sm text-muted-foreground">Date of birth</div>
                <Input
                  type="date"
                  value={isEditing ? form.date_of_birth : asDateInputValue(profile.date_of_birth)}
                  onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                  disabled={!isEditing}
                  style={{ borderRadius: 12 }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">Bio</div>
              <Textarea
                value={isEditing ? form.bio : String(profile.bio ?? '')}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                disabled={!isEditing}
                rows={5}
                placeholder="Tell us about yourself…"
              />
            </div>
          </CardContent>
        </Card>

        <Card style={{ borderRadius: radiusCard }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent workspaces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentWorkspaces.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recent workspaces.</div>
            ) : (
              recentWorkspaces.map((w) => {
                const wsId = normalizeId(w.id)
                const role = workspaceRoles[wsId] ?? w.role ?? null

                return (
                  <div
                    key={wsId}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                    style={{ borderRadius: 14 }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{w.name}</div>
                      {w.created_at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(w.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <span
                      className="inline-flex shrink-0 items-center border bg-background px-2 py-0.5 text-xs text-foreground"
                      style={{ borderRadius: 12 }}
                    >
                      {role ? String(role).toUpperCase() : '—'}
                    </span>
                  </div>
                )
              })
            )}

            <div className="pt-2">
              <Button variant="outline" onClick={() => void load()} style={{ borderRadius: 12 }}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
