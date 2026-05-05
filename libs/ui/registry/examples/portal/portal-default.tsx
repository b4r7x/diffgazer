"use client";

import { useState } from "react"
import { Portal } from "@/components/ui/shared/portal"

export default function PortalDefault() {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative p-4 border border-border overflow-hidden h-32">
      <p className="text-sm text-foreground mb-2">
        Content is clipped by overflow:hidden on this container.
      </p>
      <button
        className="text-xs text-blue-400 underline"
        onClick={() => setVisible(!visible)}
      >
        {visible ? "Hide" : "Show"} portaled content
      </button>
      {visible && (
        <Portal>
          <div className="fixed bottom-4 right-4 z-50 rounded border border-border bg-background p-3 text-sm text-foreground shadow-lg">
            This content renders outside the clipped container via Portal.
          </div>
        </Portal>
      )}
    </div>
  )
}
