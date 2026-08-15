"use client";

import { useState } from "react";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";

const hotkeys: Record<string, string> = {
  "1": "new",
  "2": "open",
  "3": "save",
  "4": "export",
};

export default function MenuKeyboard() {
  const [selectedId, setSelectedId] = useState<string | null>("new");

  return (
    <div className="w-64 border border-border">
      <Menu
        selectedId={selectedId}
        onSelect={setSelectedId}
        onKeyDown={(event) => {
          const id = hotkeys[event.key];
          if (!id) return;
          event.preventDefault();
          setSelectedId(id);
        }}
        aria-label="File actions"
      >
        <MenuItem id="new" hotkey={1}>
          New File
        </MenuItem>
        <MenuItem id="open" hotkey={2}>
          Open File
        </MenuItem>
        <MenuItem id="save" hotkey={3}>
          Save
        </MenuItem>
        <MenuItem id="export" hotkey={4}>
          Export
        </MenuItem>
        <MenuDivider />
        <MenuItem id="delete" variant="danger">
          Delete
        </MenuItem>
      </Menu>
      {/* One hint line: each hint stays whole, wrapping happens only at the separators. */}
      <p className="flex flex-wrap items-center gap-x-2 whitespace-nowrap px-3 py-2 text-xs text-muted-foreground border-t border-border">
        <span>tab in</span>
        <span aria-hidden="true">·</span>
        <span>↑↓ nav</span>
        <span aria-hidden="true">·</span>
        <span>1-4 jump</span>
        <span aria-hidden="true">·</span>
        <span>⏎ select</span>
      </p>
    </div>
  );
}
