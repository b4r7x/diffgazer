import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const panelHeaderVariants = cva("", {
  variants: {
    variant: {
      default: "flex items-center justify-between border-b border-border bg-secondary/30 px-6 py-4 text-sm font-semibold text-foreground",
      terminal:
        "flex items-center justify-between bg-secondary text-muted-foreground text-xs px-3 py-1 border-b border-border font-bold uppercase tracking-wider",
      subtle:
        "bg-secondary/30 text-muted-foreground text-xs p-2 border-b border-border uppercase tracking-widest text-center",
    },
  },
  defaultVariants: { variant: "default" },
});

export type PanelHeaderProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof panelHeaderVariants>;

export function PanelHeader({ className, variant, ...props }: PanelHeaderProps) {
  return <div data-slot="panel-header" className={cn(panelHeaderVariants({ variant }), className)} {...props} />;
}
