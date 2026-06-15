import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for empty state description. */
export type EmptyStateDescriptionProps = ComponentPropsWithRef<"p">;

/** Secondary supporting copy. Font size adapts via context. */
export function EmptyStateDescription({ className, ...props }: EmptyStateDescriptionProps) {
  return (
    <p
      className={cn(
        "text-muted-foreground",
        "group-data-[size=sm]/es:text-2xs",
        "group-data-[size=md]/es:text-xs",
        "group-data-[size=lg]/es:text-sm",
        className,
      )}
      {...props}
    />
  );
}
