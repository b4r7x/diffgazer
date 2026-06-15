import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Class variants for kbd. */
export const kbdVariants = cva(
  "inline-flex items-center justify-center border border-border bg-secondary font-mono text-foreground rounded-sm",
  {
    variants: {
      size: {
        sm: "px-1 py-0.5 text-2xs min-w-[18px]",
        md: "px-1.5 py-0.5 text-xs min-w-[20px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

/** Props for kbd. */
export interface KbdProps extends ComponentProps<"kbd">, VariantProps<typeof kbdVariants> {}

/** Keyboard key indicator rendered as an inline kbd element with terminal styling. */
export function Kbd({ ref, className, size, ...props }: KbdProps) {
  return (
    <kbd ref={ref} data-slot="kbd" className={cn(kbdVariants({ size }), className)} {...props} />
  );
}
