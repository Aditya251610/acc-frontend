"use client"

import { Check, ChevronsUpDown, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/workspace-context"

export default function WorkspaceSwitcher({ className }: { className?: string }) {
  const {
    workspaces,
    loadingWorkspaces,
    refreshWorkspaces,
    workspaceId,
    selectWorkspace,
  } = useWorkspace()

  const selected =
    (workspaceId
      ? workspaces.find((w) => String(w.id) === String(workspaceId))
      : null) ?? null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-between", className)}
          style={{ borderRadius: 12 }}
        >
          <span className="truncate">
            {selected ? selected.name : "Select workspace"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Workspaces
        </div>
        <DropdownMenuSeparator />

        {loadingWorkspaces ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : workspaces.length === 0 ? (
          <DropdownMenuItem disabled>No workspaces</DropdownMenuItem>
        ) : (
          workspaces.map((w) => {
            const isSelected = String(w.id) === String(workspaceId)
            return (
              <DropdownMenuItem
                key={String(w.id)}
                onClick={() => selectWorkspace(w.id)}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Check
                    className={cn(
                      "h-4 w-4",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{w.name}</span>
                </span>
              </DropdownMenuItem>
            )
          })
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void refreshWorkspaces()}
          className="text-muted-foreground"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
