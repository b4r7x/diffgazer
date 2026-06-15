import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Class variants for panel content. */
export const panelContentVariants = cva("text-sm text-foreground", {
  variants: {
    spacing: {
      none: "",
      sm: "space-y-2",
      md: "space-y-4",
    },
  },
  defaultVariants: { spacing: "md" },
});

/** Props for panel content. */
export type PanelContentProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof panelContentVariants>;

/** Padded content area with configurable inner spacing. */
export function PanelContent({ className, spacing, ...props }: PanelContentProps) {
  return (
    <div
      {...props}
      data-slot="panel-content"
      className={cn(panelContentVariants({ spacing }), className)}
    />
  );
}
