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
              <CommandPalette.Item id="history" value="Go to History">
                Go to History
              </CommandPalette.Item>
              <CommandPalette.Item id="theme" value="Switch Theme" shortcut="⌘T">
                Switch Theme
              </CommandPalette.Item>
              <CommandPalette.Item id="export" value="Export PDF">
                Export PDF
              </CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="System">
              <CommandPalette.Item id="settings" value="Settings Hub" shortcut=",">
                Settings Hub
              </CommandPalette.Item>
              <CommandPalette.Item id="logout" value="Log Out">
                Log Out
              </CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
