"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type TocListProps = ComponentPropsWithRef<"ul">;

export function TocList({ className, children, ref, ...props }: TocListProps) {
  return (
    <ul
      ref={ref}
      role="list"
      className={cn("border-l border-border flex flex-col gap-1.5", className)}
      {...props}
    >
      {children}
    </ul>
  );
}