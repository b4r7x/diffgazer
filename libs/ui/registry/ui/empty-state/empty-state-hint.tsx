import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateHintProps = ComponentPropsWithRef<"p">;

/**
 * Quiet keyboard affordance, designed to hold Kbd children. Non-interactive by
 * design: on a touch surface there is no key to press, so render
 * EmptyState.Actions there instead. Font size adapts via context.
 */
export function EmptyStateHint({ className, ...props }: EmptyStateHintProps) {
  return (
    <p
      data-slot="empty-state-hint"
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 mt-0.5 text-muted-foreground",
        // One step below Description at md/lg and equal at sm (10px is the
        // floor): the hint is the quietest thing in the block and the last in
        // reading order.
        "group-data-[size=sm]/es:text-2xs",
        "group-data-[size=md]/es:text-2xs",
        "group-data-[size=lg]/es:text-xs",
        className,
      )}
      {...props}
    />
  );
}
