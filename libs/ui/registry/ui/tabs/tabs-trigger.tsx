"use client";

import { type ButtonHTMLAttributes, type FocusEvent, type MouseEvent, type Ref } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { getTabPanelId, getTabTriggerId, useTabsContext } from "./tabs-context";

export const tabsTriggerVariants = cva(
  "text-sm font-mono transition-colors motion-reduce:transition-none cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
  {
    variants: {
      variant: {
        default: "px-3 py-1 border border-border",
        underline: "border-0 border-b-2 border-transparent bg-transparent rounded-none px-0 pb-3",
      },
      state: {
        active: "",
        inactive: "",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "default", state: "active", class: "bg-foreground text-background font-bold border-foreground" },
      { variant: "default", state: "inactive", disabled: false, class: "bg-background text-foreground hover:bg-secondary focus-visible:bg-foreground focus-visible:text-background focus-visible:font-bold focus-visible:border-foreground" },
      { variant: "underline", state: "active", class: "border-b-foreground text-foreground font-bold focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background" },
      { variant: "underline", state: "inactive", disabled: false, class: "text-muted-foreground hover:text-foreground hover:border-b-border focus-visible:text-foreground focus-visible:border-b-foreground focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background" },
    ],
    defaultVariants: {
      variant: "default",
      state: "inactive",
      disabled: false,
    },
  }
);

export interface TabsTriggerProps<TValue extends string = string>
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "disabled"> {
  value: TValue;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function TabsTrigger<TValue extends string = string>({ value, children, className, disabled, ref, onClick, onFocus, ...rest }: TabsTriggerProps<TValue>) {
  const { tabsId, value: selectedValue, tabbableValue, onChange, onFocusChange, panelValues, variant, orientation } = useTabsContext();
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
      data-orientation={orientation}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(
        tabsTriggerVariants({ variant, state: isActive ? "active" : "inactive", disabled: !!disabled }),
        className
      )}
    >
      {children}
    </button>
  );
}
