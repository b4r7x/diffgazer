"use client";

import { type KeyboardEvent, useId, useRef, useState } from "react";
import { usePresence } from "@/hooks/use-presence";

export default function UsePresenceTooltipExample() {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { present } = usePresence({ open, ref: tooltipRef });
  const openTooltip = () => setOpen(true);
  const closeTooltip = () => setOpen(false);
  const closeOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-center py-12">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the non-focusable hover region keeps the tooltip hoverable while keyboard access stays on the button. */}
      <div className="relative inline-block" onMouseEnter={openTooltip} onMouseLeave={closeTooltip}>
        <button
          type="button"
          aria-describedby={present ? tooltipId : undefined}
          onFocus={openTooltip}
          onBlur={closeTooltip}
          onKeyDown={closeOnEscape}
          className="font-mono text-sm border border-border px-3 py-1.5 bg-background hover:bg-muted transition-colors"
        >
          Hover me
        </button>

        {present && (
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            data-state={open ? "open" : "closed"}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-[var(--z-popover)] whitespace-nowrap rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs motion-safe:data-[state=open]:animate-[slide-in_0.15s_ease-out] motion-safe:data-[state=closed]:animate-[slide-out_0.15s_ease-in_forwards]"
          >
            Terminal tooltip ▸
          </div>
        )}
      </div>
    </div>
  );
}
