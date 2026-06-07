"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";

export default function CommandPaletteTones() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Tones</Button>
      <CommandPalette open={open} onOpenChange={setOpen}>
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Type a command…" />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="Navigation">
              <CommandPalette.Item id="history" tone="nav">
                Go to History
              </CommandPalette.Item>
              <CommandPalette.Item id="branch" tone="nav">
                Switch Branch
              </CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="Actions">
              <CommandPalette.Item id="export" tone="action">
                Export PDF
              </CommandPalette.Item>
              <CommandPalette.Item id="deploy" tone="action">
                Deploy preview
              </CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="AI">
              <CommandPalette.Item id="explain" tone="ai">
                Ask the assistant
              </CommandPalette.Item>
              <CommandPalette.Item id="summary" tone="ai">
                Summarize diff
              </CommandPalette.Item>
            </CommandPalette.Group>
            <CommandPalette.Group heading="Danger">
              <CommandPalette.Item id="reset" tone="destructive">
                Reset workspace
              </CommandPalette.Item>
              <CommandPalette.Item id="logout" tone="destructive">
                Log out
              </CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
