"use client";

import { type ReactNode, type Ref, useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useNavigationListContext } from "./navigation-list-context";
import { NavigationListItemContext } from "./navigation-list-item-context";

const itemVariants = cva("flex cursor-pointer group", {
  variants: {
    active: {
      true: "bg-foreground text-background",
      false: "hover:bg-secondary border-b border-border/50",
    },
    disabled: {
      true: "opacity-50 cursor-not-allowed",
    },
  },
  defaultVariants: {
    active: false,
    disabled: false,
  },
});

const contentVariants = cva("flex-1 grid grid-cols-[1fr_auto] auto-rows-auto gap-y-0.5", {
  variants: {
    density: {
      compact: "p-2",
      default: "p-3",
      comfortable: "p-4",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

type Density = NonNullable<VariantProps<typeof contentVariants>["density"]>;

export interface NavigationListItemProps {
  id: string;
  density?: Density;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function NavigationListItem({
  id,
  disabled = false,
  density = "default",
  children,
  className,
  ref,
}: NavigationListItemProps) {
  const { selectedId, highlightedId, activate, highlight, focused, idPrefix } =
    useNavigationListContext();
  const isSelected = selectedId === id;
  const isHighlighted = highlightedId === id;
  const isActive = (isSelected || isHighlighted) && focused;
  const labelId = `${idPrefix}-${id}-label`;
  const descId = `${idPrefix}-${id}-desc`;

  const handleClick = () => {
    if (!disabled) activate(id);
  };

  const handleHighlight = () => {
    if (!disabled) highlight(id);
  };

  const itemContextValue = useMemo(
    () => ({ labelId, descId }),
    [labelId, descId],
  );

  return (
    <NavigationListItemContext value={itemContextValue}>
      <div
        ref={ref}
        id={`${idPrefix}-${id}`}
        role="option"
        aria-labelledby={labelId}
        aria-describedby={`${descId}-meta ${descId}-sub`}
        data-value={id}
        data-active={isActive || undefined}
        data-state={isSelected ? "selected" : "unselected"}
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        onClick={handleClick}
        onMouseEnter={handleHighlight}
        onFocus={handleHighlight}
        className={cn(itemVariants({ active: isActive, disabled }), "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground", className)}
      >
        <div
          className={cn(
            "w-1 shrink-0",
            isActive ? "bg-background/40" : "bg-transparent group-hover:bg-muted"
          )}
        />
        <div className={contentVariants({ density })}>
          {children}
        </div>
      </div>
    </NavigationListItemContext>
  );
}
