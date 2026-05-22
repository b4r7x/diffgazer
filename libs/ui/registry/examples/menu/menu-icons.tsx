"use client"

import { Menu, MenuItem, MenuDivider } from "@/components/ui/menu"

export default function MenuIcons() {
  return (
    <div className="w-64 border border-border">
      <Menu aria-label="Actions">
        <MenuItem id="new" icon={<span>+</span>} hotkey="Ctrl+N">New File</MenuItem>
        <MenuItem id="open" icon={<span>^</span>} hotkey="Ctrl+O">Open Folder</MenuItem>
        <MenuItem id="search" icon={<span>/</span>} hotkey="Ctrl+P">Search Files</MenuItem>
        <MenuDivider />
        <MenuItem id="rename" icon={<span>~</span>} hotkey="F2">Rename</MenuItem>
        <MenuItem id="move" icon={<span>&gt;</span>}>Move to...</MenuItem>
        <MenuDivider />
        <MenuItem id="delete" icon={<span>x</span>} variant="danger" hotkey="Del">Delete File</MenuItem>
      </Menu>
    </div>
  )
}
