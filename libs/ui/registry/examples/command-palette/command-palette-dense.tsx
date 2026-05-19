"use client";

import { useState } from "react";
import { CommandPalette } from "@/components/ui/command-palette";
import { Button } from "@/components/ui/button";

export default function CommandPaletteDense() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Dense</Button>
      <CommandPalette open={open} onOpenChange={setOpen}>
        <CommandPalette.Content density="dense">
          <CommandPalette.Input placeholder="Type a command…" />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="File">
              <CommandPalette.Item id="new-file" shortcut="⌘N">New file</CommandPalette.Item>
              <CommandPalette.Item id="save" shortcut="⌘S">Save</CommandPalette.Item>
              <CommandPalette.Item id="close" shortcut="⌘W">Close tab</CommandPalette.Item>
              <CommandPalette.Item id="reload" shortcut="⌘R">Reload</CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="View">
              <CommandPalette.Item id="toggle-sidebar" shortcut="⌘\\">Toggle sidebar</CommandPalette.Item>
              <CommandPalette.Item id="toggle-terminal" shortcut="⌃`">Toggle terminal</CommandPalette.Item>
              <CommandPalette.Item id="zen">Zen mode</CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
