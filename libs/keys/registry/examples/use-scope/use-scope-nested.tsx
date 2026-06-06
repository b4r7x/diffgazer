"use client"

import { KeyboardProvider, useKey, useScope } from "@diffgazer/keys"
import { useState } from "react"

function Page() {
  const [log, setLog] = useState("page")
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lives in the global scope; fires only while no deeper scope is active.
  useKey("Escape", () => setLog("page Escape"))

  return (
    <div>
      <p>Escape here logs from the page. Open the drawer to see a deeper scope win.</p>
      <button type="button" onClick={() => setDrawerOpen((open) => !open)}>
        {drawerOpen ? "Close drawer" : "Open drawer"}
      </button>
      {drawerOpen && <Drawer log={log} setLog={setLog} />}
    </div>
  )
}

function Drawer({ log, setLog }: { log: string; setLog: (v: string) => void }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const scope = useScope("drawer")

  useKey("Escape", () => setLog("drawer Escape"), { scope })

  return (
    <div style={{ marginTop: 8, padding: 12, border: "1px solid currentColor" }}>
      <p>Drawer scope active. Escape logs from the drawer, not the page.</p>
      <button type="button" onClick={() => setDialogOpen(true)}>
        Open dialog
      </button>
      {dialogOpen && <Dialog onClose={() => setDialogOpen(false)} setLog={setLog} />}
      <p>Last handler: {log}</p>
    </div>
  )
}

function Dialog({ onClose, setLog }: { onClose: () => void; setLog: (v: string) => void }) {
  const scope = useScope("dialog")

  // Deepest scope: Escape resolves here, shadowing drawer and page.
  useKey("Escape", () => {
    setLog("dialog Escape")
    onClose()
  }, { scope })

  return (
    <div role="dialog" aria-label="Dialog" style={{ marginTop: 8, padding: 12, border: "1px solid currentColor" }}>
      <p>Dialog scope is deepest. Escape closes the dialog and yields back to the drawer.</p>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}

export default function UseScopeNested() {
  return (
    <KeyboardProvider>
      <Page />
    </KeyboardProvider>
  )
}
