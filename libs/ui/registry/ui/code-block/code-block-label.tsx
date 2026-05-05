"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type CodeBlockLabelProps = ComponentProps<"span">;

export function CodeBlockLabel({ className, children, ref, ...props }: CodeBlockLabelProps) {
  return (
    <span ref={ref} className={cn("text-xs text-foreground/60 font-bold uppercase tracking-wider", className)} {...props}>
      {children}
    </span>
  );
}
