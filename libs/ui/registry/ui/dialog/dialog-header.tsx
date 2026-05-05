"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 shrink-0", className)} {...props} />
  );
}
