"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import type { TextareaResizeAxis } from "./use-textarea-resize";

/**
 * Visual form of an edge handle. `line` is a short mark held off the border;
 * both `box` forms sit on the border itself, which runs unbroken behind them.
 */
export type TextareaResizeHandle = "line" | "box" | "box-label";

const AXIS_LABEL = { vertical: "vertically", horizontal: "horizontally" } as const;
const AXIS_ARROW = { vertical: "↕", horizontal: "↔" } as const;

function ResizeLine({ axis, invalid }: { axis: TextareaResizeAxis; invalid: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-slot="textarea-resize-handle"
      data-handle="line"
      className={cn(
        // 30x1, centred on the edge and held 10px off the border so it reads as
        // a second mark rather than a thickening of the field's own edge.
        "pointer-events-none absolute transition-colors",
        axis === "vertical"
          ? "top-2.5 left-1/2 h-px w-[30px] -translate-x-1/2"
          : "top-1/2 left-2.5 h-[30px] w-px -translate-y-1/2",
        invalid
          ? "bg-error"
          : "bg-border group-focus-within/textarea:bg-ring group-hover/resizer:bg-foreground group-focus-visible/resizer:bg-foreground group-data-[state=active]/resizer:bg-foreground",
      )}
    />
  );
}

function ResizeBox({
  axis,
  invalid,
  label,
}: {
  axis: TextareaResizeAxis;
  invalid: boolean;
  label: boolean;
}) {
  const isVertical = axis === "vertical";

  return (
    <span
      aria-hidden="true"
      data-slot="textarea-resize-handle"
      data-handle={label ? "box-label" : "box"}
      className={cn(
        // Centred on the field's border, which stays unbroken behind it. Half of
        // the chip therefore overhangs the hit band, so it must keep its own
        // pointer events for that half to stay grabbable.
        "absolute flex items-center justify-center gap-1 border bg-background transition-colors",
        "font-mono text-3xs leading-none tracking-wider uppercase",
        isVertical
          ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
          : "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 [writing-mode:vertical-rl]",
        !label && "size-5",
        label && (isVertical ? "h-5 px-1.5" : "w-5 py-1.5"),
        invalid
          ? "border-error text-error"
          : cn(
              "border-border text-muted-foreground group-focus-within/textarea:border-ring",
              "group-hover/resizer:border-foreground group-hover/resizer:bg-foreground group-hover/resizer:text-background",
              "group-focus-visible/resizer:border-foreground group-focus-visible/resizer:bg-foreground group-focus-visible/resizer:text-background",
              "group-data-[state=active]/resizer:border-foreground group-data-[state=active]/resizer:bg-foreground group-data-[state=active]/resizer:text-background",
            ),
      )}
    >
      {/* The chip rotates on the right edge; the arrow must not, or ↔ reads as ↕. */}
      <span className={cn(!isVertical && "[writing-mode:horizontal-tb]")}>{AXIS_ARROW[axis]}</span>
      {label ? <span>resize</span> : null}
    </span>
  );
}

export interface TextareaResizerProps extends ComponentProps<"button"> {
  /** Edge this resizer drives. */
  axis: TextareaResizeAxis;
  /** Visual form of the handle. */
  handle: TextareaResizeHandle;
  /** Whether a drag is currently in progress on this axis. */
  active: boolean;
  /** Whether the field is in its error state. */
  invalid: boolean;
  /** Accessible name for the handle. Defaults to `Resize textarea <axis>`. */
  label?: string;
}

/**
 * One resizable edge: an invisible 16px hit band carrying the chosen handle.
 * The band sits entirely outside the field so it never steals a click from the
 * text or the scrollbar.
 */
export function TextareaResizer({
  axis,
  handle,
  active,
  invalid,
  className,
  label,
  ...props
}: TextareaResizerProps) {
  const isVertical = axis === "vertical";
  const accessibleLabel = label ?? `Resize textarea ${AXIS_LABEL[axis]}`;

  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      data-slot="textarea-resizer"
      data-axis={axis}
      data-state={active ? "active" : undefined}
      className={cn(
        "group/resizer absolute touch-none bg-transparent focus-visible:outline-hidden",
        // When both axes resize, each band stops at the other's so they never
        // overlap and the corner stays deliberately empty.
        isVertical
          ? "inset-x-0 bottom-0 h-4 cursor-ns-resize group-data-[resize=both]/textarea:right-4"
          : "inset-y-0 right-0 w-4 cursor-ew-resize group-data-[resize=both]/textarea:bottom-4",
        className,
      )}
      {...props}
    >
      {handle === "line" ? (
        <ResizeLine axis={axis} invalid={invalid} />
      ) : (
        <ResizeBox axis={axis} invalid={invalid} label={handle === "box-label"} />
      )}
    </button>
  );
}
