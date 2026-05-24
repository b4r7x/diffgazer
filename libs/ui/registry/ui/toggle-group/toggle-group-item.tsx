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
import { useToggleGroupContext } from "./toggle-group-context";
import { composeRefs } from "@/lib/compose-refs";
import { segmentedItemVariants } from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";

export interface ToggleGroupItemProps<TValue extends string = string>
  extends Omit<ComponentPropsWithRef<"button">, "children" | "disabled" | "value"> {
  value: TValue;
  count?: number;
  disabled?: boolean;
  children: ReactNode;
}

function BracketMarkers({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="mr-1 text-foreground opacity-0 group-data-[active=true]/segmented-item:opacity-100"
      >
        [
      </span>
      {children}
      <span
        aria-hidden="true"
        className="ml-1 text-foreground opacity-0 group-data-[active=true]/segmented-item:opacity-100"
      >
        ]
      </span>
    </>
  );
}

export function ToggleGroupItem<TValue extends string = string>({
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
}: ToggleGroupItemProps<TValue>) {
  const context = useToggleGroupContext();
  const itemId = useId();
  const rootRef = useRef<HTMLButtonElement>(null);
  const isActive = context.isItemSelected(value);
  const isHighlighted = context.highlightedValue === value;
  const isDisabled = context.disabled || !!disabled;
  const isTabTarget = !isDisabled && context.tabTargetValue === value;
  const { registerItem, unregisterItem, variant } = context;

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
    if (!event.defaultPrevented) context.onHighlightChange(value);
  };

  useLayoutEffect(() => {
    registerItem(itemId, value, disabled === true, rootRef.current);
    return () => unregisterItem(itemId);
  }, [registerItem, unregisterItem, itemId, value, disabled]);

  // BracketMarkers apply to the bracket variant regardless of `count`. The
  // count renders as a separate styled span after the label, so the brackets
  // only ever wrap the actual children — never the count.
  const renderedChildren =
    variant === "bracket" ? (
      <BracketMarkers>{children}</BracketMarkers>
    ) : (
      children
    );

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
        // group/segmented-item lets the bracket markers (and any future
        // decoration) react to data-active without a separate context read.
        "group/segmented-item",
        segmentedItemVariants({
          variant,
          size: context.size,
          highlighted: isHighlighted && !isActive || undefined,
        }),
        className,
      )}
    >
      {renderedChildren}
      {count != null && (
        <>
          {" "}
          <span
            data-slot="toggle-group-count"
            className="tabular-nums opacity-70"
          >
            {count}
          </span>
        </>
      )}
    </button>
  );
}
