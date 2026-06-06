"use client"

import { useScrollLock } from "@diffgazer/keys"
import { useRef, useState } from "react"

export default function UseScrollLockTarget() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [locked, setLocked] = useState(false)

  // Lock a specific scroll container instead of document.body.
  useScrollLock({ target: scrollRef, enabled: locked })

  return (
    <div>
      <button type="button" onClick={() => setLocked((v) => !v)}>
        {locked ? "Unlock panel" : "Lock panel"}
      </button>

      <div
        ref={scrollRef}
        style={{ marginTop: 8, height: 120, overflow: "auto", border: "1px solid currentColor", padding: 8 }}
      >
        {Array.from({ length: 20 }, (_, i) => `Scrollable row ${i + 1}`).map((row) => (
          <p key={row} style={{ margin: "4px 0" }}>
            {row}
          </p>
        ))}
      </div>
      <p>Scrolling inside the panel is blocked while locked; the page itself is untouched.</p>
    </div>
  )
}
