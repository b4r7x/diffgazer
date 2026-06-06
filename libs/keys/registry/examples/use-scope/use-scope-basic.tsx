"use client"

import { KeyboardProvider, useKey, useScope } from "@diffgazer/keys"
import { useState } from "react"

function App() {
  const [modalOpen, setModalOpen] = useState(false)

  useKey("ctrl+k", () => setModalOpen(true))

  return (
    <div>
      <p>Press Ctrl+K to open the modal. The "ctrl+k" binding lives in the global scope.</p>
      {modalOpen && <Modal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

function Modal({ onClose }: { onClose: () => void }) {
  const scope = useScope("modal")
  useKey("Escape", onClose, { scope })

  return (
    <div role="dialog" aria-label="Modal" style={{ marginTop: 8, padding: 12, border: "1px solid currentColor" }}>
      <p>Modal scope is active: Esc closes, Ctrl+K is suppressed.</p>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  )
}

export default function UseScopeBasic() {
  return (
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  )
}
