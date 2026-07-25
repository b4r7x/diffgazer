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
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { BracketMarkers } from "@/lib/segmented-brackets";
import { segmentedItemVariants } from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";
import { useToggleGroupContext } from "./toggle-group-context";

/** Props for toggle group item. */
export interface ToggleGroupItemProps<TValue extends string = string>
  extends Omit<ComponentPropsWithRef<"button">, "children" | "disabled" | "value"> {
  /** Stable identifier matched against the group value. */
  value: TValue;
  /** Optional trailing count rendered as [label count]. */
  count?: number;
  /** Disables this item only; removed from arrow navigation and focus. */
  disabled?: boolean;
  /** Item label. */
  children: ReactNode;
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
  const composedRef = useComposedRefs(rootRef, ref);
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
    variant === "bracket" ? <BracketMarkers state="on">{children}</BracketMarkers> : children;

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "radio" (Biome cannot resolve the ternary); aria-checked is applied only in the radio branch and aria-pressed only in the button branch.
    <button
      {...props}
      ref={composedRef}
      type="button"
      role={context.usesButtonSemantics ? undefined : "radio"}
      data-value={value}
      data-diffgazer-navigation-item={context.usesButtonSemantics ? "button" : "radio"}
      data-state={isActive ? "on" : "off"}
      data-highlighted={isHighlighted ? "" : undefined}
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
        // decoration) react to data-state without a separate context read.
        "group/segmented-item",
        segmentedItemVariants({
          variant,
          size: context.size,
          highlighted: (isHighlighted && !isActive) || undefined,
        }),
        className,
      )}
    >
      {renderedChildren}
      {/* The item is a flex container, so a whitespace text node between the
          label and the count is not rendered; it only keeps the accessible name
          as "Error 3". The visible gutter is a margin, and tabular-nums keeps
          multi-digit counts on one column. */}
      {count != null && (
        <>
          {" "}
          <span data-slot="toggle-group-count" className="ml-1.5 tabular-nums opacity-70">
            {count}
          </span>
        </>
      )}
    </button>
  );
}
