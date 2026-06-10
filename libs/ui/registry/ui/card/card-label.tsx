import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cornerLabelVariants } from "@/lib/corner-label-variants";
import { cn } from "@/lib/utils";

export const cardLabelVariants = cornerLabelVariants;

export type CardLabelProps = ComponentPropsWithRef<"div"> & VariantProps<typeof cardLabelVariants>;

export function CardLabel({ className, variant, ...props }: CardLabelProps) {
  return (
    <div
      data-slot="card-label"
      className={cn(cardLabelVariants({ variant }), className)}
      {...props}
    />
  );
}
