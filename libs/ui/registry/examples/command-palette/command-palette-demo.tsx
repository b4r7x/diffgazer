"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import { Kbd } from "@/components/ui/kbd";

export default function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Command Palette</Button>
      <CommandPalette open={open} onOpenChange={setOpen}>
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Type a command or search…" />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="Suggested">
              <CommandPalette.Item id="history">Go to History</CommandPalette.Item>
              <CommandPalette.Item id="theme" shortcut="⌘T">
                Switch Theme
              </CommandPalette.Item>
              <CommandPalette.Item id="export">Export PDF</CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="System">
              <CommandPalette.Item id="settings" shortcut=",">
                Settings Hub
              </CommandPalette.Item>
              <CommandPalette.Item id="diagnostics">Run Diagnostics</CommandPalette.Item>
              <CommandPalette.Item id="logout">Log Out</CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
          <CommandPalette.Footer>
            <span className="inline-flex items-center gap-1.5">
              <Kbd size="sm">↑</Kbd>
              <Kbd size="sm">↓</Kbd>
              Navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd size="sm">↵</Kbd>
              Select
            </span>
          </CommandPalette.Footer>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
