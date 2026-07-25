import { cva } from "class-variance-authority";
import type { ReactNode } from "react";

// Tabs emit data-state="active", ToggleGroup emits data-state="on", so each
// state carries its own literal class — Tailwind only sees statically written
// candidates, and an interpolated selector would be purged from the stylesheet.
const segmentedBracketVariants = cva("", {
  variants: {
    side: {
      start: "mr-1",
      end: "ml-1",
    },
    state: {
      active: "text-foreground opacity-0 group-data-[state=active]/segmented-item:opacity-100",
      on: "text-foreground opacity-0 group-data-[state=on]/segmented-item:opacity-100",
    },
  },
});

/** Props for segmented bracket markers. */
export interface BracketMarkersProps {
  /** Selected `data-state` value emitted by the parent segmented item. */
  state: "active" | "on";
  /** Label wrapped by the markers. */
  children: ReactNode;
}

/**
 * Decorative [ ] markers that fade in when the parent segmented item is selected.
 * Requires the parent to carry `group/segmented-item`.
 */
export function BracketMarkers({ state, children }: BracketMarkersProps) {
  return (
    <>
      <span aria-hidden="true" className={segmentedBracketVariants({ side: "start", state })}>
        [
      </span>
      {children}
      <span aria-hidden="true" className={segmentedBracketVariants({ side: "end", state })}>
        ]
      </span>
    </>
  );
}
