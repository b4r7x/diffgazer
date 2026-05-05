"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateActionsProps = ComponentPropsWithRef<"div">;

export function EmptyStateActions({ className, ...props }: EmptyStateActionsProps) {
  return (
    <div
      className={cn(
        "flex",
        "group-data-[size=sm]/es:gap-1.5",
        "group-data-[size=md]/es:gap-2",
        "group-data-[size=lg]/es:gap-3",
        className,
      )}
      {...props}
    />
  );
}
