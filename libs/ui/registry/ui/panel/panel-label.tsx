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
 */
export function PanelLabel({ className, variant, ...props }: PanelLabelProps) {
  const { hasCorners } = usePanelContext();

  return (
    <div
      data-slot="panel-label"
      className={cn(cornerLabelVariants({ variant }), hasCorners && "left-8", className)}
      {...props}
    />
  );
}
