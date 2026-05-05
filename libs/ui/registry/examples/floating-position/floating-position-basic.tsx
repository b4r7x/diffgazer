"use client";

import { useRef, useState } from "react"
import { useFloatingPosition } from "@/hooks/use-floating-position"

export default function FloatingPositionBasicExample() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { position, contentRef } = useFloatingPosition({
    triggerRef,
    open,
    side: "bottom",
    align: "start",
  })

  return (
    <div className="relative py-12">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-sm border border-border px-3 py-1.5 bg-background hover:bg-muted transition-colors"
      >
        {open ? "Close" : "Open"} floating
      </button>

      {open && (
        <div
          ref={contentRef}
          style={
            position
              ? { position: "fixed", left: position.x, top: position.y }
              : { position: "fixed", opacity: 0 }
          }
          className="z-50 w-48 border border-border bg-background p-3 font-mono text-sm shadow-md"
        >
          <p className="text-foreground">Floating content</p>
          <p className="text-muted-foreground text-xs mt-1">
            Side: {position?.side ?? "—"} · Align: {position?.align ?? "—"}
          </p>
        </div>
      )}
    </div>
  )
}
