"use client";

import { useRef, useState } from "react"
import { useOutsideClick } from "@/hooks/use-outside-click"

export default function OutsideClickBasicExample() {
  const [open, setOpen] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useOutsideClick(ref, () => setOpen(false))

  return (
    <div className="flex flex-col gap-4 items-start">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="font-mono text-sm border border-border px-3 py-1.5 bg-background hover:bg-muted transition-colors"
        >
          Show panel
        </button>
      )}

      {open && (
        <div
          ref={ref}
          className="w-64 border border-border bg-muted p-4 font-mono text-sm"
        >
          <p className="text-foreground">Click outside to dismiss</p>
          <p className="text-muted-foreground text-xs mt-2">
            This panel closes when you click outside it.
          </p>
        </div>
      )}
    </div>
  )
}
