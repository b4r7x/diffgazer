"use client";

import type { HTMLAttributes, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const kbdVariants = cva(
  "inline-flex items-center justify-center border border-border bg-secondary font-mono text-foreground rounded-sm",
  {
    variants: {
      size: {
        sm: "px-1 py-0.5 text-[10px] min-w-[18px]",
        md: "px-1.5 py-0.5 text-xs min-w-[20px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface KbdProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof kbdVariants> {
  ref?: Ref<HTMLElement>;
}

export function Kbd({ ref, className, size, ...props }: KbdProps) {
  return (
    <kbd ref={ref} className={cn(kbdVariants({ size }), className)} {...props} />
  );
}