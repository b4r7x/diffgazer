import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export const panelLabelVariants = cva(
  "absolute -top-3 left-4 z-[var(--z-base)] bg-background px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground",
  {
    variants: {
      variant: {
        border: "border border-border",
        gap: "",
      },
    },
    defaultVariants: { variant: "border" },
  },
);

export type PanelLabelProps = ComponentPropsWithRef<"div"> & VariantProps<typeof panelLabelVariants>;

export function PanelLabel({ className, variant, ...props }: PanelLabelProps) {
  return (
    <div
      data-slot="panel-label"
      className={cn(panelLabelVariants({ variant }), className)}
      {...props}
    />
  );
}
