"use client"

import { useState } from "react"
import { Chevron } from "@/components/ui/icons"

export default function ChevronAnimated() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Chevron open={open} />
        <span>Click to toggle ({open ? "open" : "closed"})</span>
      </button>
      <div className="flex items-center gap-6 text-muted-foreground">
        <div className="flex items-center gap-2">
          <Chevron open={open} size="sm" />
          <span className="text-xs font-mono">sm</span>
        </div>
        <div className="flex items-center gap-2">
          <Chevron open={open} size="md" />
          <span className="text-xs font-mono">md</span>
        </div>
        <div className="flex items-center gap-2">
          <Chevron open={open} size="lg" />
          <span className="text-xs font-mono">lg</span>
        </div>
      </div>
    </div>
  )
}
