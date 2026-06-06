"use client"

import { useScrollLock } from "@diffgazer/keys"
import { useState } from "react"

function Overlay({ onClose }: { onClose: () => void }) {
  useScrollLock()

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: "none", padding: 0, background: "rgba(0,0,0,0.6)", cursor: "pointer" }}
      />
      <div style={{ position: "relative", padding: 16, background: "white", color: "black" }}>
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
