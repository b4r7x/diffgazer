"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> {}

export function DialogBody({ className, ...props }: DialogBodyProps) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex-1 overflow-y-auto px-5 py-5", className)}
      {...props}
    />
  );
}
