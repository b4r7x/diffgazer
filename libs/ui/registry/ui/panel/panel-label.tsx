import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cornerLabelVariants } from "@/lib/corner-label-variants";
import { cn } from "@/lib/utils";

export const panelLabelVariants = cornerLabelVariants;

export type PanelLabelProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof panelLabelVariants>;

export function PanelLabel({ className, variant, ...props }: PanelLabelProps) {
  return (
    <div
      data-slot="panel-label"
      className={cn(panelLabelVariants({ variant }), className)}
      {...props}
    />
  );
}
