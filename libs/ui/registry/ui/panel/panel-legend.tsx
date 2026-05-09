import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const panelLegendVariants = cva(
  "absolute -top-3 left-4 z-10 bg-background px-2 text-xs font-bold uppercase tracking-wider",
  {
    variants: {
      tone: {
        default: "text-foreground",
        muted: "text-muted-foreground",
        info: "text-info-fg",
        success: "text-success",
        warning: "text-warning-fg",
        error: "text-error-fg",
        accent: "text-action",
      },
    },
    defaultVariants: {
      tone: "muted",
    },
  },
);

export type PanelLegendProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof panelLegendVariants>;

export function PanelLegend({ className, tone, ...props }: PanelLegendProps) {
  return <div data-slot="panel-legend" className={cn(panelLegendVariants({ tone }), className)} {...props} />;
}
