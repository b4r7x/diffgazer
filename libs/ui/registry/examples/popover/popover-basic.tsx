"use client";

import { Popover } from "@/components/ui/popover";

export default function PopoverBasicExample() {
  return (
    <Popover>
      <Popover.Trigger>
        {(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            className="border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            click me
          </button>
        )}
      </Popover.Trigger>
      <Popover.Content role="dialog" aria-label="Popover actions" className="p-4 font-mono text-sm">
        <p className="text-foreground">Popover content with interactive elements.</p>
        <button
          type="button"
          className="mt-2 border border-foreground/30 px-2 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          action
        </button>
      </Popover.Content>
    </Popover>
  );
}
