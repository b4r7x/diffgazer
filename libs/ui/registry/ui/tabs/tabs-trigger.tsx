"use client";

import { type ButtonHTMLAttributes, type FocusEvent, type MouseEvent, type ReactNode, type Ref } from "react";
import { segmentedItemVariants } from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";
import { getTabPanelId, getTabTriggerId, useTabsContext } from "./tabs-context";

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

export interface TabsTriggerProps<TValue extends string = string>
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "disabled"> {
  value: TValue;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function TabsTrigger<TValue extends string = string>({
  value,
  children,
  className,
  disabled,
  ref,
  onClick,
  onFocus,
  ...rest
}: TabsTriggerProps<TValue>) {
  const {
    tabsId,
    value: selectedValue,
    tabbableValue,
    onChange,
    onFocusChange,
    panelValues,
    variant,
    size,
    orientation,
  } = useTabsContext();
  const isActive = selectedValue === value;
  const isTabbable = tabbableValue === value;
  const panelId = panelValues.includes(value) ? getTabPanelId(tabsId, value) : undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
    if (!event.defaultPrevented) onChange(value);
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
    if (!event.defaultPrevented && !disabled) onFocusChange(value);
  };

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      id={getTabTriggerId(tabsId, value)}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      tabIndex={isTabbable && !disabled ? 0 : -1}
      data-diffgazer-navigation-item="tab"
      data-value={value}
      data-state={isActive ? "active" : "inactive"}
      data-active={isActive || undefined}
      data-orientation={orientation}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(
        // group/segmented-item lets the bracket markers (and any future
        // decoration) react to data-active without a separate context read.
        "group/segmented-item",
        segmentedItemVariants({ variant, size }),
        className,
      )}
    >
      {variant === "bracket" ? <BracketMarkers>{children}</BracketMarkers> : children}
    </button>
  );
}
