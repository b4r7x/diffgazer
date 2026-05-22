"use client"

import { useState } from "react"
import { Menu, MenuItem, MenuDivider, MenuSub, MenuSubTrigger, MenuSubContent } from "@/components/ui/menu"

export default function MenuSubmenu() {
  const [lastAction, setLastAction] = useState<string | null>(null)

  return (
    <div className="w-64 border border-border">
      <Menu
        aria-label="Application menu"
        onSelect={(id) => setLastAction(id)}
      >
        <MenuItem id="new" hotkey={1}>New File</MenuItem>
        <MenuItem id="open" hotkey={2}>Open File</MenuItem>
        <MenuDivider />
        <MenuSub>
          <MenuSubTrigger id="edit">Edit</MenuSubTrigger>
          <MenuSubContent>
            <MenuItem id="undo">Undo</MenuItem>
            <MenuItem id="redo">Redo</MenuItem>
            <MenuDivider />
            <MenuItem id="cut">Cut</MenuItem>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste">Paste</MenuItem>
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger id="view">View</MenuSubTrigger>
          <MenuSubContent>
            <MenuItem id="zoom-in">Zoom In</MenuItem>
            <MenuItem id="zoom-out">Zoom Out</MenuItem>
            <MenuItem id="reset-zoom">Reset Zoom</MenuItem>
          </MenuSubContent>
        </MenuSub>
        <MenuDivider />
        <MenuItem id="quit" variant="danger">Quit</MenuItem>
      </Menu>
      {lastAction && (
        <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
          Last action: {lastAction}
        </p>
      )}
    </div>
  )
}
