"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";

/**
 * The empty state, pinned open with a search value that matches nothing so the
 * fallback copy is visible without typing.
 */
export default function CommandPaletteEmpty() {
  const [open, setOpen] = useState(true);

  return (
    <>
      {!open ? (
        <Button type="button" onClick={() => setOpen(true)}>
          Show palette
        </Button>
      ) : null}
      <CommandPalette open={open} onOpenChange={setOpen} search="qqq">
        <CommandPalette.Content modal={false} label="Empty palette">
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
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </>
  );
}
