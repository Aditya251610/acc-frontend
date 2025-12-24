"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  style,
  ...props
}: React.ComponentProps<"textarea"> & { style?: React.CSSProperties }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{ borderRadius: 12, ...style }}
      {...props}
    />
  )
}

export { Textarea }
