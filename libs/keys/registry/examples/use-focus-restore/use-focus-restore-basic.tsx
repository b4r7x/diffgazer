"use client"

import { useFocusRestore } from "@diffgazer/keys"
import { useEffect, useRef, useState } from "react"

export default function UseFocusRestoreBasic() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const focusRestore = useFocusRestore({ restoreOnUnmount: true })

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  const openPanel = () => {
    focusRestore.capture()
    setOpen(true)
  }

  const closePanel = () => {
    setOpen(false)
    focusRestore.restore()
  }

  return (
    <div>
      <button type="button" onClick={openPanel}>
        Open panel
      </button>

      {open && (
        <div ref={panelRef} role="dialog" aria-label="Temporary panel" tabIndex={-1}>
          <p>Focus returns to the opener when this panel closes.</p>
          <button type="button" onClick={closePanel}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
