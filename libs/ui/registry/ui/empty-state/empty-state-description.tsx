"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateDescriptionProps = ComponentPropsWithRef<"p">;

export function EmptyStateDescription({ className, ...props }: EmptyStateDescriptionProps) {
  return (
    <p
      className={cn(
        "text-muted-foreground",
        "group-data-[size=sm]/es:text-[10px]",
        "group-data-[size=md]/es:text-xs",
        "group-data-[size=lg]/es:text-sm",
        className,
      )}
      {...props}
    />
  );
}
