export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8000"

export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("authToken")
}

export function clearAuthToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem("authToken")
  window.dispatchEvent(new Event("authChange"))
}

type JwtPayload = Record<string, unknown>

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const json = atob(padded)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function getAuthUserId(): string | null {
  if (typeof window === "undefined") return null
  const token = getAuthToken()
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload) return null

  const candidates = [payload.user_id, payload.userId, payload.sub, payload.id]
  for (const value of candidates) {
    if (value === undefined || value === null) continue
    const s = String(value)
    if (s && s !== "undefined" && s !== "null") return s
  }
  return null
}

export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("workspaceId")
}

export function getWorkspaceIdNumber(): number | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("workspaceId")
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function setWorkspaceId(id: string | number) {
  if (typeof window === "undefined") return
  const n = Number(id)
  if (Number.isFinite(n)) localStorage.setItem("workspaceId", String(n))
  else localStorage.setItem("workspaceId", String(id))
}

export function clearWorkspaceId() {
  if (typeof window === "undefined") return
  localStorage.removeItem("workspaceId")
  window.dispatchEvent(new Event("workspaceChange"))
}

export function apiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalized}`
}

export async function apiFetch(
  path: string,
  init?: RequestInit & { auth?: boolean },
) {
  const { auth, headers, ...rest } = init ?? {}

  const mergedHeaders: HeadersInit = {
    ...(headers ?? {}),
  }

  if (auth) {
    const token = getAuthToken()
    if (!token) {
      // Do not hit backend if auth is required but token is missing.
      return new Response("", { status: 401, statusText: "Unauthorized" })
    }
    ;(mergedHeaders as Record<string, string>).Authorization = `Bearer ${token}`
  }

  return fetch(apiUrl(path), {
    ...rest,
    headers: mergedHeaders,
  })
}

async function safeReadJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "")
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function extractErrorMessage(status: number, body: unknown): string {
  if (status === 401) return "Unauthorized (401). Please login again."
  if (status === 403) return "Forbidden (403). You do not have permission for this action."

  if (body && typeof body === "object") {
    const maybeDetail = (body as Record<string, unknown>).detail
    if (typeof maybeDetail === "string" && maybeDetail.trim()) return maybeDetail
  }
  if (typeof body === "string" && body.trim()) return body
  return `Request failed (${status})`
}

export async function apiFetchJson<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const res = await apiFetch(path, init)
  if (!res.ok) {
    const body = await safeReadJson(res)
    throw new ApiError(extractErrorMessage(res.status, body), res.status, body)
  }
  return (await res.json()) as T
}

