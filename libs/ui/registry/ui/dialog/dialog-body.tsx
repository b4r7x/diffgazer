"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> {}

export function DialogBody({ className, ...props }: DialogBodyProps) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto border-x border-border px-6 py-6", className)}
      {...props}
    />
  );
}
