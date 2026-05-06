import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const cardLabelVariants = cva(
  "absolute -top-3 left-4 z-10 bg-background px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground",
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

export type CardLabelProps = ComponentPropsWithRef<"div"> & VariantProps<typeof cardLabelVariants>;

export function CardLabel({ className, variant, ...props }: CardLabelProps) {
  return <div data-slot="card-label" className={cn(cardLabelVariants({ variant }), className)} {...props} />;
}
