"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for dialog body. */
export interface DialogBodyProps extends ComponentProps<"div"> {}

/** Scrollable content. */
export function DialogBody({ className, ...props }: DialogBodyProps) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex-1 overflow-y-auto px-5 py-5", className)}
      {...props}
    />
  );
}
