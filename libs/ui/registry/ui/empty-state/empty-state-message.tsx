import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for empty state message. */
export type EmptyStateMessageProps = ComponentPropsWithRef<"div">;

/** Primary empty-state copy. Font size adapts via context. */
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
