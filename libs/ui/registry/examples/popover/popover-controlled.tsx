"use client";

import { useState } from "react";
import { Popover } from "@/components/ui/popover";

export default function PopoverControlledExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          {(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              className="border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0"
            >
              {open ? "close" : "open"}
            </button>
          )}
        </Popover.Trigger>
        <Popover.Content className="p-3 font-mono text-xs text-foreground">
          Controlled popover
          <button
            type="button"
            className="mt-2 block border border-foreground/30 px-2 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0"
            onClick={() => setOpen(false)}
          >
            dismiss
          </button>
        </Popover.Content>
      </Popover>

      <span className="font-mono text-xs text-foreground/60">
        state: {open ? "open" : "closed"}
      </span>
    </div>
  );
}
