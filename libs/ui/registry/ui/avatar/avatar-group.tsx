"use client";

import { Children, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AvatarGroupContext } from "./avatar-context";
import { AvatarIndicator } from "./avatar-indicator";
import { Overflow } from "../overflow/overflow";

export interface AvatarGroupProps {
  max?: number;
  /** How avatars are spaced. "overlap" (default) stacks them, "gap" adds spacing between. */
  spacing?: "overlap" | "gap";
  children: ReactNode;
  size?: "sm" | "md" | "lg" | null;
  className?: string;
  "aria-label"?: string;
}

const spacingClasses = {
  overlap: "-space-x-1.5",
  gap: "gap-1",
} satisfies Record<string, string>;

export function AvatarGroup({ max, spacing = "overlap", children, size = "md", className, "aria-label": ariaLabel = "Avatars" }: AvatarGroupProps) {
  const allItems = Children.toArray(children);
  const groupContextValue = useMemo(() => ({ size }), [size]);

  if (max != null) {
    const visibleItems = allItems.slice(0, max);
    const overflowCount = allItems.length - max;

    return (
      <AvatarGroupContext value={groupContextValue}>
        <div role="group" aria-label={ariaLabel} className={cn("flex w-fit items-center", spacingClasses[spacing], className)}>
          {visibleItems}
          {overflowCount > 0 && <AvatarIndicator count={overflowCount} />}
        </div>
      </AvatarGroupContext>
    );
  }

  return (
    <AvatarGroupContext value={groupContextValue}>
      <div role="group" aria-label={ariaLabel}>
        <Overflow
          mode="items"
          gap={spacingClasses[spacing]}
          className={className}
          indicator={({ count }) => <AvatarIndicator count={count} />}
        >
          {allItems}
        </Overflow>
      </div>
    </AvatarGroupContext>
  );
}
