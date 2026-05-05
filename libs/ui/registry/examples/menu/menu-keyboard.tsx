"use client"

import { KeyboardProvider, useKey } from "@diffgazer/keys"
import { Menu, MenuItem, MenuDivider } from "@/components/ui/menu"
import { useState } from "react"

const hotkeys: Record<string, string> = {
  "1": "new",
  "2": "open",
  "3": "save",
  "4": "export",
}

function MenuWithHotkeys() {
  const [selectedId, setSelectedId] = useState<string | null>("new")

  useKey(
    Object.fromEntries(
      Object.entries(hotkeys).map(([key, id]) => [key, () => setSelectedId(id)])
    )
  )

  return (
    <div className="w-64 border border-border">
      <Menu
        selectedId={selectedId}
        onSelect={setSelectedId}
        aria-label="File actions"
      >
        <MenuItem id="new" hotkey={1}>New File</MenuItem>
        <MenuItem id="open" hotkey={2}>Open File</MenuItem>
        <MenuItem id="save" hotkey={3}>Save</MenuItem>
        <MenuItem id="export" hotkey={4}>Export</MenuItem>
        <MenuDivider />
        <MenuItem id="delete" variant="danger">Delete</MenuItem>
      </Menu>
      <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
        ↑↓ navigate · 1-4 jump · Enter select
      </p>
    </div>
  )
}

export default function MenuKeyboard() {
  return (
    <KeyboardProvider>
      <MenuWithHotkeys />
    </KeyboardProvider>
  )
}
