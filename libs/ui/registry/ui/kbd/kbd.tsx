import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Class variants for kbd. */
export const kbdVariants = cva(
  "inline-flex items-center justify-center border font-mono rounded-sm",
  {
    variants: {
      size: {
        sm: "px-1 py-0.5 text-2xs min-w-[18px]",
        md: "px-1.5 py-0.5 text-xs min-w-[20px]",
      },
      // Which surface the cap sits on. The fill is a translucent step off --foreground
      // rather than --secondary so the key reads at the same inline weight in every
      // palette: --secondary is a near-white surface in light themes, which flattened the
      // cap to an outline. `inverse` mirrors the same recipe against --background, for
      // bars painted in --foreground (shortcut legends, footers), where the default cap's
      // foreground text would be invisible.
      variant: {
        default: "border-border bg-foreground/15 text-foreground",
        inverse: "border-background/30 bg-background/10 text-background",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  },
);

/** Props for kbd. */
export interface KbdProps extends ComponentProps<"kbd">, VariantProps<typeof kbdVariants> {}

/** Keyboard key indicator rendered as an inline kbd element with terminal styling. */
export function Kbd({ ref, className, size, variant, ...props }: KbdProps) {
  return (
    <kbd
      ref={ref}
      data-slot="kbd"
      className={cn(kbdVariants({ size, variant }), className)}
      {...props}
    />
  );
}
