"use client";

import { useLayoutEffect, type ReactNode, type Ref } from "react";
import { cva } from "class-variance-authority";
import { useToggleGroupContext } from "./toggle-group-context";
import { cn } from "@/lib/utils";

const toggleItemVariants = cva(
  "inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer border border-border bg-transparent text-foreground hover:bg-secondary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary data-[active=true]:hover:bg-primary/90",
  {
    variants: {
      size: {
        sm: "min-h-[44px] min-w-[44px] px-2 py-0.5 text-xs",
        md: "h-9 px-4 py-2 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface ToggleGroupItemProps {
  value: string;
  count?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function ToggleGroupItem({
  value,
  count,
  disabled,
  className,
  children,
  ref,
}: ToggleGroupItemProps) {
  const context = useToggleGroupContext();
  const { registerItem } = context;
  const isActive = context.value === value;
  const isHighlighted = context.highlightedValue === value;
  const isDisabled = context.disabled || !!disabled;
  const hasSelection = context.value !== null;
  const isTabTarget = !isDisabled && (isActive || (!hasSelection && context.firstEnabledValue === value));

  useLayoutEffect(() => {
    return registerItem(value, isDisabled);
  }, [isDisabled, registerItem, value]);

  return (
    <button
      ref={ref}
      type="button"
      role={context.allowDeselect ? undefined : "radio"}
      data-value={value}
      data-diffgazer-navigation-item={context.allowDeselect ? "button" : "radio"}
      data-active={isActive || undefined}
      data-highlighted={isHighlighted || undefined}
      aria-checked={context.allowDeselect ? undefined : isActive}
      aria-pressed={context.allowDeselect ? isActive : undefined}
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      tabIndex={isTabTarget ? 0 : -1}
      onClick={() => { if (!isDisabled) context.onChange(value); }}
      onMouseEnter={() => { if (!isDisabled) context.onHighlightChange(value); }}
      onFocus={() => { if (!isDisabled) context.onHighlightChange(value); }}
      className={cn(
        toggleItemVariants({ size: context.size }),
        isDisabled && "pointer-events-none opacity-50",
        isHighlighted && !isActive && "bg-secondary",
        className,
      )}
    >
      {count != null ? (
        <>
          [{children} {count}]
        </>
      ) : (
        children
      )}
    </button>
  );
}
