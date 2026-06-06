"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";

export default function CommandPaletteTerminal() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Terminal</Button>
      <CommandPalette open={open} onOpenChange={setOpen}>
        <CommandPalette.Content frame="terminal">
          <CommandPalette.Input placeholder="Type a command…" />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="Suggested">
              <CommandPalette.Item id="history">Go to History</CommandPalette.Item>
              <CommandPalette.Item id="theme" shortcut="⌘T">Switch Theme</CommandPalette.Item>
              <CommandPalette.Item id="export">Export PDF</CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="System">
              <CommandPalette.Item id="settings" shortcut=",">Settings Hub</CommandPalette.Item>
              <CommandPalette.Item id="logout">Log Out</CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
