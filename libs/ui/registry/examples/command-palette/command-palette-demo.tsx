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
              <CommandPalette.Item id="diagnostics" value="Run Diagnostics">
                Run Diagnostics
              </CommandPalette.Item>
              <CommandPalette.Item id="logout" value="Log Out">
                Log Out
              </CommandPalette.Item>
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
