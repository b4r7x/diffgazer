"use client";

import { Tooltip } from "@/components/ui/tooltip";

export default function TooltipInteractiveExample() {
  return (
    <div className="flex items-center gap-6">
      <Tooltip>
        <Tooltip.Trigger>
          {(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              className="border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              save
            </button>
          )}
        </Tooltip.Trigger>
        <Tooltip.Content>Save changes to disk</Tooltip.Content>
      </Tooltip>

      <Tooltip>
        <Tooltip.Trigger>
          {(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              aria-disabled="true"
              onClick={(event) => event.preventDefault()}
              className="border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 opacity-50"
            >
              delete
            </button>
          )}
        </Tooltip.Trigger>
        <Tooltip.Content>Remove selected items</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
