"use client"

import { toast } from "sonner"

import { ApiError, clearAuthToken, clearWorkspaceId } from "@/lib/api"

export type HandledApiErrorKind = "unauthorized" | "forbidden" | "not-found" | "other"

function toStatus(error: unknown): number | null {
  return error instanceof ApiError ? error.status : null
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Request failed"
}

export function handleApiError(error: unknown): { handled: boolean; kind: HandledApiErrorKind } {
  const status = toStatus(error)

  if (status === 401) {
    try {
      localStorage.setItem("sessionExpired", "1")
    } catch {
      // ignore
    }

    clearWorkspaceId()
    clearAuthToken()

    if (typeof window !== "undefined") {
      window.location.assign("/login")
    }

    return { handled: true, kind: "unauthorized" }
  }

  if (status === 403) {
    toast.error("Insufficient permissions")
    return { handled: true, kind: "forbidden" }
  }

  if (status === 404) {
    return { handled: true, kind: "not-found" }
  }

  // Default: surface message.
  toast.error(toMessage(error))
  return { handled: false, kind: "other" }
}
