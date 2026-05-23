"use client"

import { useRef, useState } from "react"
import { useFocusTrap } from "@diffgazer/keys"

export default function UseFocusTrapBasic() {
  const [open, setOpen] = useState(false)
  const trapRef = useRef<HTMLDivElement>(null)

  useFocusTrap(trapRef, { enabled: open, restoreFocus: true })

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open Panel
      </button>

      {open && (
        <div
          ref={trapRef}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm action"
          tabIndex={-1}
          style={{ marginTop: 8, padding: 12, border: "1px solid currentColor" }}
        >
          <p>Tab cycles through buttons; focus is trapped here.</p>
          <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" onClick={() => setOpen(false)}>Confirm</button>
        </div>
      )}
    </div>
  )
}
