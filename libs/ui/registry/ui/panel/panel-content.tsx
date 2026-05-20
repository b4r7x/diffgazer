import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Vertical rhythm for direct children of `Panel.Content`. Use `spacing="none"`
 * when composing `Panel.Row` siblings (rows own their own padding and an
 * automatic adjacent-sibling divider).
 *
 * - `none`: no gap (rows / custom layout own their own spacing).
 * - `sm`:   8px gap.
 * - `md`:   16px gap (default — comfortable for prose/form bodies).
 */
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

export type PanelContentProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof panelContentVariants>;

export function PanelContent({ className, spacing, ...props }: PanelContentProps) {
  return (
    <div
      {...props}
      data-slot="panel-content"
      className={cn(panelContentVariants({ spacing }), className)}
    />
  );
}
