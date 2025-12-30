import { ApiError, apiFetch, extractErrorMessage } from "@/lib/api"

type CacheEntry = {
  url: string
  createdAt: number
  lastAccessAt: number
  sizeBytes?: number
}

const MAX_ENTRIES = 50

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string>>()

let listenersAttached = false

function cacheKey(workspaceId: string | number, mediaId: string | number) {
  return `${String(workspaceId)}:${String(mediaId)}`
}

function revokeUrl(url: string) {
  if (!url || !url.startsWith("blob:")) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // ignore
  }
}

function evictIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return

  // Evict least-recently-used entries.
  const entries = Array.from(cache.entries())
  entries.sort((a, b) => a[1].lastAccessAt - b[1].lastAccessAt)

  const toEvict = Math.max(0, cache.size - MAX_ENTRIES)
  for (let i = 0; i < toEvict; i++) {
    const [key, entry] = entries[i]
    revokeUrl(entry.url)
    cache.delete(key)
  }
}

export function clearMediaCache() {
  for (const entry of cache.values()) {
    revokeUrl(entry.url)
  }
  cache.clear()
  inflight.clear()
}

export function removeCachedMedia(workspaceId: string | number, mediaId: string | number) {
  if (typeof window === "undefined") return
  ensureListeners()

  const key = cacheKey(workspaceId, mediaId)
  const entry = cache.get(key)
  if (entry) {
    revokeUrl(entry.url)
    cache.delete(key)
  }
  inflight.delete(key)
}

function ensureListeners() {
  if (listenersAttached) return
  if (typeof window === "undefined") return

  // Clear cache on auth/workspace changes (token/user may change).
  window.addEventListener("authChange", clearMediaCache)
  window.addEventListener("workspaceChange", () => {
    // Keep cache bounded anyway; clearing avoids cross-workspace memory growth.
    clearMediaCache()
  })

  listenersAttached = true
}

export function getCachedMediaUrl(workspaceId: string | number, mediaId: string | number): string | null {
  if (typeof window === "undefined") return null
  ensureListeners()

  const key = cacheKey(workspaceId, mediaId)
  const entry = cache.get(key)
  if (!entry) return null

  entry.lastAccessAt = Date.now()
  cache.set(key, entry)
  return entry.url
}

export async function getOrFetchMediaUrl(workspaceId: string | number, mediaId: string | number): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Media cache can only be used in the browser")
  }

  ensureListeners()

  const key = cacheKey(workspaceId, mediaId)
  const cached = cache.get(key)
  if (cached?.url) {
    cached.lastAccessAt = Date.now()
    cache.set(key, cached)
    return cached.url
  }

  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async () => {
    const res = await apiFetch(`/workspaces/${workspaceId}/media/${mediaId}/download`, {
      method: "GET",
      auth: true,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new ApiError(extractErrorMessage(res.status, body), res.status, body)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    cache.set(key, {
      url,
      createdAt: Date.now(),
      lastAccessAt: Date.now(),
      sizeBytes: blob.size,
    })

    evictIfNeeded()
    return url
  })()

  inflight.set(
    key,
    promise.finally(() => {
      inflight.delete(key)
    }),
  )

  return inflight.get(key) as Promise<string>
}
