"use client";

import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cornerLabelVariants } from "@/lib/corner-label-variants";
import { cn } from "@/lib/utils";
import { usePanelContext } from "./panel-context";

/** Props for panel label. */
export type PanelLabelProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof cornerLabelVariants>;

/**
 * Floating corner label (e.g. [ 01 / FS_TREE ]). The Panel root is the positioning context
 * (panel.css sets position: relative on every frame). The inline-start inset is derived from the
 * panel: when the frame draws corner brackets (viewfinder, or any frame while focused) the label
 * steps past the bracket arm, because its background is opaque and would paint over it.
 *
 * `variant="readout"` instead seats the label on the top rule between the two bracket arms and
 * repaints it in --ring while the pane is focused, so the label and the corners read as one
 * instrument. `data-inset` and `data-state` expose those two decisions to consumers and tests.
 */
export function PanelLabel({ className, variant, ...props }: PanelLabelProps) {
  const { hasCorners, focused } = usePanelContext();
  const resolvedVariant = variant ?? "border";
  const isReadout = resolvedVariant === "readout";
  // The readout tracks the bracket arm it sits beside; every other variant just
  // clears the fixed resting arm.
  const cornerInset = isReadout ? "left-[calc(var(--viewfinder-size)+10px)]" : "left-8";

  return (
    <div
      data-slot="panel-label"
      data-variant={resolvedVariant}
      data-inset={hasCorners ? "corner" : "edge"}
      data-state={focused ? "focused" : undefined}
      className={cn(
        cornerLabelVariants({ variant }),
        hasCorners && cornerInset,
        isReadout && focused && "text-ring",
        className,
      )}
      {...props}
    />
  );
}
