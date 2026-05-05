"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateMessageProps = ComponentPropsWithRef<"div">;

export function EmptyStateMessage({ className, ...props }: EmptyStateMessageProps) {
  return (
    <div
      className={cn(
        "text-foreground font-bold",
        "group-data-[size=sm]/es:font-semibold",
        "group-data-[size=sm]/es:text-xs",
        "group-data-[size=md]/es:text-sm",
        "group-data-[size=lg]/es:text-base",
        className,
      )}
      {...props}
    />
  );
}
