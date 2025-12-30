"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { LoaderOne } from "@/components/ui/loader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch, getWorkspaceIdNumber, setWorkspaceId } from "@/lib/api"
import { useWorkspace } from "@/lib/workspace-context"

type Workspace = {
  id: number
  name: string
  created_at?: string
}

export default function DashboardPage() {
  const { refreshRole } = useWorkspace()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (!selectedId) return null
    return workspaces.find((w) => String(w.id) === String(selectedId)) ?? null
  }, [selectedId, workspaces])

  async function loadWorkspaces() {
    setLoading(true)
    try {
      const res = await apiFetch("/workspaces", { method: "GET", auth: true })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Failed to load workspaces (${res.status})`)
      }
      const data = (await res.json()) as Workspace[]
      setWorkspaces(data)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load workspaces"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const ws = getWorkspaceIdNumber()
    setSelectedId(ws ? String(ws) : null)
    void loadWorkspaces()
  }, [])

  async function onCreate() {
    const trimmed = name.trim()
    if (!trimmed) return

    try {
      const res = await apiFetch("/workspaces", {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Failed to create workspace (${res.status})`)
      }

      const created = (await res.json()) as Workspace
      setWorkspaces((prev) => [created, ...prev])
      setWorkspaceId(created.id)
      setSelectedId(String(created.id))
      setName("")
      toast.success("Workspace created")
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create workspace"
      toast.error(message)
    }
  }

  function onSelect(id: number) {
    setWorkspaceId(id)
    setSelectedId(String(id))
    void refreshRole()
    toast.success("Workspace selected")
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Select a workspace to scope Videos, Audios, and Upload.
      </p>

      <div
        className="mt-6 rounded-xl border bg-card p-4"
        style={{ borderRadius: 16 }}
      >
        <div className="text-sm font-medium">Current workspace</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {selected ? (
            <span className="text-foreground">{selected.name}</span>
          ) : (
            <span>None selected. Create one below or pick from the list.</span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="New workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ borderRadius: 12 }}
          />
          <Button
            onClick={onCreate}
            disabled={!name.trim()}
            className="bg-[#6F26D4] text-white hover:bg-[#6F26D4]/90"
            style={{ borderRadius: 12 }}
          >
            Create
          </Button>
        </div>
      </div>

      <div
        className="mt-6 rounded-xl border bg-card p-4"
        style={{ borderRadius: 16 }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">Your workspaces</div>
          <Button
            variant="outline"
            onClick={loadWorkspaces}
            disabled={loading}
            style={{ borderRadius: 12 }}
            className="w-full sm:w-auto"
          >
            Refresh
          </Button>
        </div>

        {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderOne />
              <span>Loading…</span>
            </div>
        ) : workspaces.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">
            No workspaces yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            {workspaces.map((w) => {
              const isSelected = String(w.id) === String(selectedId)
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                  style={{ borderRadius: 14 }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{w.name}</div>
                  </div>
                  <Button
                    onClick={() => onSelect(w.id)}
                    disabled={isSelected}
                    className={
                      isSelected
                        ? "bg-[#6F26D4]/20 text-[#6F26D4] hover:bg-[#6F26D4]/20"
                        : "bg-[#6F26D4] text-white hover:bg-[#6F26D4]/90"
                    }
                    style={{ borderRadius: 12 }}
                  >
                    {isSelected ? "Selected" : "Select"}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Go to{" "}
        <Link className="text-[#6F26D4] underline" href="/videos">
          Videos
        </Link>
        ,{" "}
        <Link className="text-[#6F26D4] underline" href="/audios">
          Audios
        </Link>
        , or{" "}
        <Link className="text-[#6F26D4] underline" href="/upload">
          Upload
        </Link>
        {" "}once a workspace is selected.
      </p>
    </div>
  )
}
