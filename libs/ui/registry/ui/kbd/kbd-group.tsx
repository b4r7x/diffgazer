"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface KbdGroupProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
}

export function KbdGroup({
  ref,
  className,
  children,
  ...props
}: KbdGroupProps) {
  return (
    <kbd
      ref={ref}
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    >
      {children}
    </kbd>
  );
}
