"use client"

import { useFocusTrap } from "@diffgazer/keys"
import { useRef, useState } from "react"

export default function UseFocusTrapInitialFocus() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)

  // initialFocus moves focus to Save instead of the first focusable element.
  useFocusTrap(dialogRef, { enabled: open, initialFocus: saveRef, restoreFocus: true })

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Edit item
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Save changes"
          tabIndex={-1}
          style={{ marginTop: 8, padding: 12, border: "1px solid currentColor" }}
        >
          <p>This dialog opens with focus on Save. Tab stays inside; Esc is up to you.</p>
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button ref={saveRef} type="button" onClick={() => setOpen(false)}>
            Save
          </button>
        </div>
      )}
    </div>
  )
}
