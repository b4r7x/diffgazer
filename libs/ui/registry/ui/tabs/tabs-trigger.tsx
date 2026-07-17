"use client";

import {
  type ButtonHTMLAttributes,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { segmentedItemVariants } from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";
import { getTabPanelId, getTabTriggerId, useTabsContext } from "./tabs-context";
import { useTabsListWrapped } from "./tabs-list";

function BracketMarkers({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="mr-1 text-foreground opacity-0 group-data-[state=active]/segmented-item:opacity-100"
      >
        [
      </span>
      {children}
      <span
        aria-hidden="true"
        className="ml-1 text-foreground opacity-0 group-data-[state=active]/segmented-item:opacity-100"
      >
        ]
      </span>
    </>
  );
}

/** Props for tabs trigger. */
export interface TabsTriggerProps<TValue extends string = string>
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "disabled"> {
  /** Stable identifier matched against Tabs value and the paired Tabs.Content. */
  value: TValue;
  /** Disables activation and removes the trigger from arrow navigation. */
  disabled?: boolean;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLButtonElement>;
}

/** Clickable tab button. */
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
    registerTrigger,
    unregisterTrigger,
  } = useTabsContext();
  const registrationId = useId();
  const wrapped = useTabsListWrapped();
  const rootRef = useRef<HTMLButtonElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const isActive = selectedValue === value;
  const isTabbable = tabbableValue === value;
  const panelId = panelValues.includes(value) ? getTabPanelId(tabsId, value) : undefined;

  useLayoutEffect(() => {
    registerTrigger(registrationId, value, disabled === true, rootRef.current);
    return () => unregisterTrigger(registrationId);
  }, [registerTrigger, unregisterTrigger, registrationId, value, disabled]);

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
      ref={composedRef}
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
      data-variant={variant}
      data-wrap={wrapped}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(
        // group/segmented-item lets the bracket markers (and any future
        // decoration) react to data-state without a separate context read.
        "group/segmented-item",
        segmentedItemVariants({ variant, size, wrapped }),
        className,
      )}
    >
      {variant === "bracket" ? <BracketMarkers>{children}</BracketMarkers> : children}
    </button>
  );
}
