"use client";

import { CommandPalette } from "@/components/ui/command-palette";

export default function CommandPaletteViewfinder() {
  return (
    <CommandPalette open>
      <CommandPalette.Content modal={false} label="Viewfinder palette" frame="viewfinder">
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
        </CommandPalette.List>
      </CommandPalette.Content>
    </CommandPalette>
  );
}
