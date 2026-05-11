"use client"

import { useRef, useState } from "react"
import { KeyboardProvider, useScope, useScopedNavigation } from "@diffgazer/keys"

const commands = ["New File", "Open File", "Save", "Save As", "Close"]

function CommandPalette({ onClose }: { onClose: () => void }) {
  const listRef = useRef<HTMLDivElement>(null)

  useScope("command-palette")

  const { isHighlighted } = useScopedNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    onSelect: (value) => {
      alert(`Executed: ${value}`)
      onClose()
    },
  })

  return (
    <div style={{ marginTop: 8, padding: 8, border: "1px solid currentColor" }}>
      <h3>Command Palette</h3>
      <p>ArrowUp/ArrowDown navigate; Enter executes.</p>
      <div ref={listRef} role="listbox" tabIndex={0}>
        {commands.map((cmd) => (
          <div
            key={cmd}
            role="option"
            data-value={cmd}
            aria-selected={isHighlighted(cmd)}
            style={{ padding: "4px 8px", fontWeight: isHighlighted(cmd) ? 700 : 400 }}
          >
            {cmd}
          </div>
        ))}
      </div>
    </div>
  )
}

function App() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open Command Palette
      </button>
      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </div>
  )
}

export default function UseScopedNavigationBasic() {
  return (
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  )
}
