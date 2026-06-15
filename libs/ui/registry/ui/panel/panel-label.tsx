import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cornerLabelVariants } from "@/lib/corner-label-variants";
import { cn } from "@/lib/utils";

/** Props for panel label. */
export type PanelLabelProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof cornerLabelVariants>;

/**
 * Floating corner label (e.g. [ 01 / FS_TREE ]). The Panel root is the positioning context
 * (panel.css sets position: relative on every frame).
 */
export function PanelLabel({ className, variant, ...props }: PanelLabelProps) {
  return (
    <div
      data-slot="panel-label"
      className={cn(cornerLabelVariants({ variant }), className)}
      {...props}
    />
  );
}
