"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Children, type ComponentProps, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Overflow } from "../overflow/overflow";
import { AvatarGroupContext } from "./avatar-context";
import { AvatarIndicator } from "./avatar-indicator";

/** Class variants for avatar group spacing. */
export const avatarGroupSpacingVariants = cva("", {
  variants: {
    spacing: {
      overlap: "-space-x-1.5",
      gap: "gap-1",
    },
  },
  defaultVariants: { spacing: "overlap" },
});

/** Props for avatar group. */
export interface AvatarGroupProps extends Omit<ComponentProps<"div">, "role"> {
  /**
   * Hard cap on visible avatars. Extras render as an AvatarIndicator. When omitted, AvatarGroup
   * measures overflow with Overflow.
   */
  max?: number;
  /** Overlap stacks avatars; gap spaces them apart. */
  spacing?: NonNullable<VariantProps<typeof avatarGroupSpacingVariants>["spacing"]>;
  /** Default size applied to descendant Avatars that do not set their own size. */
  size?: "sm" | "md" | "lg" | null;
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
    const visibleItems = allItems.slice(0, max);
    const overflowCount = allItems.length - max;

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
      <div {...props} role="group" aria-label={ariaLabel}>
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
