"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import { CommandPaletteHighlightItem } from "@/components/ui/command-palette/highlight";

export default function CommandPaletteAutoTones() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Auto-Tones</Button>
      <CommandPalette open={open} onOpenChange={setOpen}>
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Type to filter & highlight…" />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="Suggestions">
              <CommandPaletteHighlightItem id="go-history">Go to History</CommandPaletteHighlightItem>
              <CommandPaletteHighlightItem id="open-settings">Open Settings</CommandPaletteHighlightItem>
              <CommandPaletteHighlightItem id="run-tests">Run tests</CommandPaletteHighlightItem>
              <CommandPaletteHighlightItem id="deploy-prod">Deploy production</CommandPaletteHighlightItem>
              <CommandPaletteHighlightItem id="ask-ai">Ask the assistant</CommandPaletteHighlightItem>
              <CommandPaletteHighlightItem id="toggle-theme">Toggle theme</CommandPaletteHighlightItem>
              <CommandPaletteHighlightItem id="delete-branch">Delete branch</CommandPaletteHighlightItem>
              <CommandPaletteHighlightItem id="logout">Log out</CommandPaletteHighlightItem>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
