"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  compact?: boolean
  className?: string
}

export default function ThemeToggle({ compact, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid hydration mismatch; default to light until mounted.
  const isDark = mounted && theme === "dark"

  return (
    <Toggle
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      pressed={isDark}
      onPressedChange={(pressed) => setTheme(pressed ? "dark" : "light")}
      variant="outline"
      size={compact ? "sm" : "default"}
      style={{ borderRadius: 12 }}
      className={cn(
        "border-border bg-transparent",
        "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
        className,
      )}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!compact && <span className="text-xs">{isDark ? "Dark" : "Light"}</span>}
    </Toggle>
  )
}
