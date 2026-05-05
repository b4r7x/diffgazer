"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateIconProps = ComponentPropsWithRef<"div">;

export function EmptyStateIcon({ className, ...props }: EmptyStateIconProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "group-data-[size=sm]/es:text-lg",
        "group-data-[size=md]/es:text-2xl",
        "group-data-[size=lg]/es:text-4xl",
        className,
      )}
      {...props}
    />
  );
}
