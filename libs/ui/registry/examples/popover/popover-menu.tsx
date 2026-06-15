"use client";

import { useState } from "react";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Popover } from "@/components/ui/popover";

export default function PopoverMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} popupRole="menu">
      <Popover.Trigger>
        {(triggerProps) => (
          <button
            {...triggerProps}
            className="border border-foreground/30 px-3 py-1 font-mono text-sm"
          >
            Actions
          </button>
        )}
      </Popover.Trigger>
      <Popover.Content className="w-56 border border-border bg-background p-0 shadow-md">
        <Menu
          aria-label="Popover actions"
          autoFocus
          onClose={() => setOpen(false)}
          onSelect={() => setOpen(false)}
        >
          <MenuItem id="copy" hotkey="C">
            Copy link
          </MenuItem>
          <MenuItem id="archive" hotkey="A">
            Archive
          </MenuItem>
          <MenuItem id="delete" variant="danger">
            Delete
          </MenuItem>
        </Menu>
      </Popover.Content>
    </Popover>
  );
}
