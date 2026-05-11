"use client"

import { useState } from "react"
import { useScrollLock } from "@diffgazer/keys"

function Overlay({ onClose }: { onClose: () => void }) {
  useScrollLock()

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ padding: 16, background: "white", color: "black" }}>
        <h3>Overlay</h3>
        <p>Background scroll is locked while this overlay is visible.</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export default function UseScrollLockBasic() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ height: 500 }}>
      <p>Scroll status: {open ? "locked" : "unlocked"}</p>
      <button type="button" onClick={() => setOpen(true)}>Show Overlay</button>
      <p>Scroll down to see content. Opening the overlay locks scroll.</p>
      {open && <Overlay onClose={() => setOpen(false)} />}
    </div>
  )
}
