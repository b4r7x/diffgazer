"use client"

import { useRef, useState } from "react"
import { useScrollLock } from "@diffgazer/keys"

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
        {Array.from({ length: 20 }, (_, i) => (
          <p key={i} style={{ margin: "4px 0" }}>
            Scrollable row {i + 1}
          </p>
        ))}
      </div>
      <p>Scrolling inside the panel is blocked while locked; the page itself is untouched.</p>
    </div>
  )
}
