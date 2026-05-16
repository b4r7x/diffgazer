"use client";

import {
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { cva } from "class-variance-authority";
import { useToggleGroupContext } from "./toggle-group-context";
import { composeRefs } from "@/lib/compose-refs";
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

export interface ToggleGroupItemProps
  extends Omit<ComponentPropsWithRef<"button">, "children" | "disabled" | "value"> {
  value: string;
  count?: number;
  disabled?: boolean;
  children: ReactNode;
}

export function ToggleGroupItem({
  value,
  count,
  disabled,
  className,
  children,
  ref,
  onClick,
  onKeyDown,
  onMouseEnter,
  onFocus,
  ...props
}: ToggleGroupItemProps) {
  const context = useToggleGroupContext();
  const itemId = useId();
  const rootRef = useRef<HTMLButtonElement>(null);
  const isActive = context.isItemSelected(value);
  const isHighlighted = context.highlightedValue === value;
  const isDisabled = context.disabled || !!disabled;
  const isTabTarget = !isDisabled && context.tabTargetValue === value;
  const { registerItem, unregisterItem } = context;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && !isDisabled) context.onChange(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (
      !event.defaultPrevented &&
      context.usesButtonSemantics &&
      !isDisabled &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      context.onChange(value);
    }
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
    if (!event.defaultPrevented && !isDisabled) context.onHighlightChange(value);
  };

  useLayoutEffect(() => {
    registerItem(itemId, value, disabled === true, rootRef.current);
    return () => unregisterItem(itemId);
  }, [registerItem, unregisterItem, itemId, value, disabled]);

  return (
    <button
      {...props}
      ref={composeRefs(rootRef, ref)}
      type="button"
      role={context.usesButtonSemantics ? undefined : "radio"}
      data-value={value}
      data-diffgazer-navigation-item={context.usesButtonSemantics ? "button" : "radio"}
      data-active={isActive || undefined}
      data-highlighted={isHighlighted || undefined}
      aria-checked={context.usesButtonSemantics ? undefined : isActive}
      aria-pressed={context.usesButtonSemantics ? isActive : undefined}
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      tabIndex={isTabTarget ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onFocus={handleFocus}
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
