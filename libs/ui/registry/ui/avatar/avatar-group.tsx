"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Children, type ComponentProps, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Overflow } from "../overflow/overflow";
import type { AvatarSize } from "./avatar";
import { AvatarGroupContext } from "./avatar-context";
import { AvatarIndicator } from "./avatar-indicator";

export const avatarGroupSpacingVariants = cva("", {
  variants: {
    spacing: {
      // gap-0 cancels the flex gap Overflow ships so overlap keeps its full
      // negative offset when these classes are merged onto that root.
      overlap: "gap-0 -space-x-1.5",
      gap: "gap-1",
    },
  },
  defaultVariants: { spacing: "overlap" },
});

export interface AvatarGroupProps extends Omit<ComponentProps<"div">, "role"> {
  /**
   * Hard cap on visible avatars. Extras render as an AvatarIndicator. When omitted, AvatarGroup
   * measures overflow with Overflow. Values are rounded down; negative and non-finite values
   * become zero.
   */
  max?: number;
  /** Overlap stacks avatars; gap spaces them apart. */
  spacing?: NonNullable<VariantProps<typeof avatarGroupSpacingVariants>["spacing"]>;
  /** Default size applied to descendant Avatars that do not set their own size. */
  size?: AvatarSize | null;
}

/** Overlapping stack of avatars with max overflow (+N indicator). */
export function AvatarGroup({
  max,
  spacing = "overlap",
  children,
  size = "md",
  className,
  "aria-label": ariaLabel = "Avatars",
  ...props
}: AvatarGroupProps) {
  const allItems = Children.toArray(children);
  const groupContextValue = useMemo(() => ({ size }), [size]);

  if (max != null) {
    const normalizedMax = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
    const visibleItems = allItems.slice(0, normalizedMax);
    const overflowCount = allItems.length - visibleItems.length;

    return (
      <AvatarGroupContext value={groupContextValue}>
        {/* biome-ignore lint/a11y/useSemanticElements: role="group" labels the related set of avatars; <fieldset> is for form controls and is not appropriate here. */}
        <div
          {...props}
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
      <div
        {...props}
        role="group"
        aria-label={ariaLabel}
        className={cn("flex w-fit items-center", className)}
      >
        <Overflow
          mode="items"
          className={avatarGroupSpacingVariants({ spacing })}
          getOverflowLabel={(count) => `${count} more`}
          indicator={({ count }) => <AvatarIndicator count={count} aria-hidden="true" />}
        >
          {allItems}
        </Overflow>
      </div>
    </AvatarGroupContext>
  );
}
