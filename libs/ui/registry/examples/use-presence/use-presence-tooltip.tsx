"use client";

import { useState } from "react"
import { usePresence } from "@/hooks/use-presence"

export default function UsePresenceTooltipExample() {
  const [open, setOpen] = useState(false)
  const { present, onAnimationEnd } = usePresence({ open })

  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative inline-block">
        <button
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="font-mono text-sm border border-border px-3 py-1.5 bg-background hover:bg-muted transition-colors"
        >
          Hover me
        </button>

        {present && (
          <div
            role="tooltip"
            data-state={open ? "open" : "closed"}
            onAnimationEnd={onAnimationEnd}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 whitespace-nowrap border border-border bg-background px-2 py-1 font-mono text-xs shadow-md data-[state=open]:animate-[slide-in_0.15s_ease-out] data-[state=closed]:animate-[slide-out_0.15s_ease-in_forwards]"
          >
            Terminal tooltip ▸
          </div>
        )}
      </div>
    </div>
  )
}
