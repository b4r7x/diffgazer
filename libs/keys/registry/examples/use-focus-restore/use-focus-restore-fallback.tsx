"use client"

import { useRef, useState } from "react"
import { useFocusRestore } from "@diffgazer/keys"

export default function UseFocusRestoreFallback() {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  // Summon opens the palette and captures the current focus. On close, focus
  // returns there; `fallback` (the editor surface) catches the case where
  // nothing was focused at open time so focus never lands on <body>.
  const focusRestore = useFocusRestore({ fallback: anchor })

  const openPalette = () => {
    focusRestore.capture()
    setOpen(true)
    queueMicrotask(() => paletteRef.current?.focus())
  }

  const closePalette = () => {
    setOpen(false)
    focusRestore.restore()
  }

  return (
    <div>
      <div ref={setAnchor} tabIndex={-1} style={{ padding: 8, border: "1px dashed currentColor" }}>
        Editor surface (restore anchor)
      </div>

      <button type="button" onClick={openPalette} style={{ marginTop: 8 }}>
        Summon palette
      </button>

      {open && (
        <div
          ref={paletteRef}
          role="dialog"
          aria-label="Command palette"
          tabIndex={-1}
          style={{ marginTop: 8, padding: 12, border: "1px solid currentColor" }}
        >
          <p>Closing restores focus to wherever it was, or to the editor surface fallback.</p>
          <button type="button" onClick={closePalette}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
