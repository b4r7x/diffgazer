"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";

export default function CommandPaletteDense() {
  const [open, setOpen] = useState(true);

  return (
    <>
      {!open ? (
        <Button type="button" onClick={() => setOpen(true)}>
          Show palette
        </Button>
      ) : null}
      <CommandPalette open={open} onOpenChange={setOpen}>
        <CommandPalette.Content modal={false} label="Dense palette" density="dense">
          <CommandPalette.Input placeholder="Type a command…" />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="File">
              <CommandPalette.Item id="new-file" value="New file" shortcut="⌘N">
                New file
              </CommandPalette.Item>
              <CommandPalette.Item id="save" value="Save" shortcut="⌘S">
                Save
              </CommandPalette.Item>
              <CommandPalette.Item id="close" value="Close tab" shortcut="⌘W">
                Close tab
              </CommandPalette.Item>
              <CommandPalette.Item id="reload" value="Reload" shortcut="⌘R">
                Reload
              </CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="View">
              <CommandPalette.Item id="toggle-sidebar" value="Toggle sidebar" shortcut="⌘\\">
                Toggle sidebar
              </CommandPalette.Item>
              <CommandPalette.Item id="toggle-terminal" value="Toggle terminal" shortcut="⌃`">
                Toggle terminal
              </CommandPalette.Item>
              <CommandPalette.Item id="zen" value="Zen mode">
                Zen mode
              </CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </>
  );
}
