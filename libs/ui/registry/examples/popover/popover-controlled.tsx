"use client";

import { useState } from "react"
import { Popover } from "@/components/ui/popover"

export default function PopoverControlledExample() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-4">
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          {(triggerProps) => (
            <button {...triggerProps} className="border border-foreground/30 px-3 py-1 font-mono text-sm">
              {open ? "close" : "open"}
            </button>
          )}
        </Popover.Trigger>
        <Popover.Content className="border border-border bg-background p-3 font-mono text-xs text-foreground shadow-md">
          Controlled popover
          <button
            className="mt-2 block border border-foreground/30 px-2 py-0.5 text-xs"
            onClick={() => setOpen(false)}
          >
            dismiss
          </button>
        </Popover.Content>
      </Popover>

      <span className="font-mono text-xs text-foreground/60">
        state: {open ? "open" : "closed"}
      </span>
    </div>
  )
}
