import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cornerLabelVariants } from "@/lib/corner-label-variants";
import { cn } from "@/lib/utils";

/** Props for card label. */
export type CardLabelProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof cornerLabelVariants>;

/** Floating border label with variant='border' or variant='gap'. */
export function CardLabel({ className, variant, ...props }: CardLabelProps) {
  return (
    <div
      data-slot="card-label"
      className={cn(cornerLabelVariants({ variant }), className)}
      {...props}
    />
  );
}
