"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Children, type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Overflow } from "../overflow/overflow";
import { AvatarGroupContext } from "./avatar-context";
import { AvatarIndicator } from "./avatar-indicator";

export const avatarGroupSpacingVariants = cva("", {
  variants: {
    spacing: {
      overlap: "-space-x-1.5",
      gap: "gap-1",
    },
  },
  defaultVariants: { spacing: "overlap" },
});

export interface AvatarGroupProps {
  max?: number;
  spacing?: NonNullable<VariantProps<typeof avatarGroupSpacingVariants>["spacing"]>;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | null;
  className?: string;
  "aria-label"?: string;
}

export function AvatarGroup({
  max,
  spacing = "overlap",
  children,
  size = "md",
  className,
  "aria-label": ariaLabel = "Avatars",
}: AvatarGroupProps) {
  const allItems = Children.toArray(children);
  const groupContextValue = useMemo(() => ({ size }), [size]);

  if (max != null) {
    const visibleItems = allItems.slice(0, max);
    const overflowCount = allItems.length - max;

    return (
      <AvatarGroupContext value={groupContextValue}>
        {/* biome-ignore lint/a11y/useSemanticElements: role="group" labels the related set of avatars; <fieldset> is for form controls and is not appropriate here. */}
        <div
          role="group"
          aria-label={ariaLabel}
          className={cn(
            "flex w-fit items-center",
            avatarGroupSpacingVariants({ spacing }),
            className,
          )}
        >
          {visibleItems}
          {overflowCount > 0 && <AvatarIndicator count={overflowCount} />}
        </div>
      </AvatarGroupContext>
    );
  }

  return (
    <AvatarGroupContext value={groupContextValue}>
      {/* biome-ignore lint/a11y/useSemanticElements: role="group" labels the related set of avatars; <fieldset> is for form controls and is not appropriate here. */}
      <div role="group" aria-label={ariaLabel}>
        <Overflow
          mode="items"
          gap={avatarGroupSpacingVariants({ spacing })}
          className={className}
          indicator={({ count }) => <AvatarIndicator count={count} />}
        >
          {allItems}
        </Overflow>
      </div>
    </AvatarGroupContext>
  );
}
