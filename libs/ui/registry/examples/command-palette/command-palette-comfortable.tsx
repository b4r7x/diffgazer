"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.6, flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

export default function CommandPaletteComfortable() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Comfortable</Button>
      <CommandPalette open={open} onOpenChange={setOpen}>
        <CommandPalette.Content frame="card" density="comfortable">
          <CommandPalette.Input
            placeholder="Search commands, files, settings…"
            prefix={<SearchIcon />}
          />
          <CommandPalette.List>
            <CommandPalette.Empty>No matching commands.</CommandPalette.Empty>
            <CommandPalette.Group heading="Workspace">
              <CommandPalette.Item id="search" value="Search files">
                Search files
              </CommandPalette.Item>
              <CommandPalette.Item id="branch" value="Switch branch" shortcut="⌘B">
                Switch branch
              </CommandPalette.Item>
              <CommandPalette.Item id="commits" value="View commits">
                View commits
              </CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    </div>
  );
}
