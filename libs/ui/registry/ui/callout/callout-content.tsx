"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CalloutContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CalloutContent({ children, className, style, ...props }: CalloutContentProps) {
  return (
    <div
      style={{ gridArea: "body", ...style }}
      className={cn(
        "text-[12px] leading-[1.55] text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
