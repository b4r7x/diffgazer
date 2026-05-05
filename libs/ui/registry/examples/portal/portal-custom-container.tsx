"use client";

import { useRef, useState } from "react"
import { Portal } from "@/components/ui/shared/portal"

export default function PortalCustomContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 border border-border">
        <p className="text-sm text-foreground mb-2">Source container</p>
        <button
          className="text-xs text-blue-400 underline"
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Hide" : "Show"} in target
        </button>
      </div>
      <div
        ref={containerRef}
        className="p-4 border border-border min-h-[4rem]"
      >
        <p className="text-sm text-muted-foreground">Target container</p>
        {visible && containerRef.current && (
          <Portal container={containerRef.current}>
            <p className="text-sm text-foreground mt-2">
              Portaled into the target container below.
            </p>
          </Portal>
        )}
      </div>
    </div>
  )
}
