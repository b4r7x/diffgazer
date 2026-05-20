"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CalloutTitleProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function CalloutTitle({ children, className, style, ...props }: CalloutTitleProps) {
  return (
    <span
      style={{ gridArea: "title", ...style }}
      className={cn(
        "self-center font-bold text-[13px] leading-[1.4] text-[color:var(--cal-tone)]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
