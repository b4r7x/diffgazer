"use client";

import type { HTMLAttributes, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const cardVariants = cva("w-full relative border border-border bg-background", {
  variants: {
    variant: {
      default: "",
      panel: "shadow-2xl",
    },
    size: {
      default: "",
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export type CardProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof cardVariants> & {
    as?: "div" | "article" | "section" | "aside";
    ref?: Ref<HTMLElement>;
  };

export function Card({ className, variant, size, as: Tag = "div", ref, ...props }: CardProps) {
  return <Tag data-slot="card" ref={ref as Ref<never>} className={cn(cardVariants({ variant, size }), className)} {...props} />;
}
