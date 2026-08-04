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
 * (panel.css sets position: relative on every frame). The inline-start inset is constant: every
 * bracket a panel draws is a 12px arm, resting or focused, so the one 16px start clears it in
 * every state and toggling focus never moves the label.
 *
 * `variant="readout"` instead seats the label on the top rule between the two bracket arms and
 * repaints it in --ring while the pane is focused, so the label and the corners read as one
 * instrument. `data-state` exposes that decision to consumers and tests.
 */
export function PanelLabel({ className, variant, ...props }: PanelLabelProps) {
  const { focused } = usePanelContext();
  const resolvedVariant = variant ?? "border";
  const isReadout = resolvedVariant === "readout";

  return (
    <div
      data-slot="panel-label"
      data-variant={resolvedVariant}
      data-state={focused ? "focused" : undefined}
      className={cn(
        cornerLabelVariants({ variant }),
        // --viewfinder-size is declared by the frames that draw brackets, and the
        // readout sits beside the arm on every frame, so the fallback restates the
        // one arm length they all use. Without it the declaration is invalid on a
        // resting frame that draws none and the label drops onto the corner.
        isReadout && "left-[calc(var(--viewfinder-size,12px)+10px)]",
        isReadout && focused && "text-ring",
        className,
      )}
      {...props}
    />
  );
}
