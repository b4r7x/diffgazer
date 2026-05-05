"use client";

import { useState } from "react";
import { CommandPalette } from "@/components/ui/command-palette";
import { Button } from "@/components/ui/button";

export default function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>("history");

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Command Palette</Button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
        onActivate={(id) => setSelectedId(id)}
      >
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Type a command..." />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="Suggested">
              <CommandPalette.Item id="history" value="Go to History">
                Go to History
              </CommandPalette.Item>
              <CommandPalette.Item
                id="theme"
                value="Switch Theme"
                shortcut="Cmd+T"
              >
                Switch Theme
              </CommandPalette.Item>
              <CommandPalette.Item id="export" value="Export PDF">
                Export PDF
              </CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="System">
              <CommandPalette.Item
                id="settings"
                value="Settings Hub"
                shortcut=","
              >
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
            <div className="flex gap-3">
              <span className="flex items-center gap-1">
                <span className="bg-border px-1 rounded text-gray-300">
                  ↑↓
                </span>{" "}
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <span className="bg-border px-1 rounded text-gray-300">
                  ↵
                </span>{" "}
                Select
              </span>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1">
                Triggered by{" "}
                <span className="text-foreground">[cmd+k]</span>
              </span>
            </div>
          </CommandPalette.Footer>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
