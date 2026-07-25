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
            type="button"
            className="border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            Actions
          </button>
        )}
      </Popover.Trigger>
      <Popover.Content className="w-56 p-0">
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
