"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex gap-3 justify-end items-center px-4 pb-4 border-x border-b border-border bg-background shrink-0",
        className
      )}
      {...props}
    />
  );
}
