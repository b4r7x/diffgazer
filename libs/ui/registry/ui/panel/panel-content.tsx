import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const panelContentVariants = cva("p-4 text-sm", {
  variants: {
    spacing: {
      none: "",
      sm: "space-y-2",
      md: "space-y-4",
    },
  },
  defaultVariants: { spacing: "md" },
});

export type PanelContentProps = ComponentPropsWithRef<"div"> & VariantProps<typeof panelContentVariants>;

export function PanelContent({ className, spacing, ...props }: PanelContentProps) {
  return <div data-slot="panel-content" className={cn(panelContentVariants({ spacing }), className)} {...props} />;
}
