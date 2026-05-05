"use client";

import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const panelVariants = cva("relative bg-background", {
  variants: {
    variant: {
      default: "border border-border shadow-2xl",
      borderless: "",
    },
  },
  defaultVariants: { variant: "default" },
});

type PanelTag = "div" | "article" | "section" | "aside";

export type PanelProps = ComponentPropsWithRef<"div"> &
  VariantProps<typeof panelVariants> & {
    as?: PanelTag;
  };

export function Panel({ className, variant, as: Tag = "div", ...props }: PanelProps) {
  return <Tag data-slot="panel" className={cn(panelVariants({ variant }), className)} {...props} />;
}