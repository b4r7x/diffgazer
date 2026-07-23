"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useRef } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { isHTMLElementForContainer } from "@/lib/aria";
import { warnUnregisteredValue } from "@/lib/warn-unregistered-value";

/** Whether arrow navigation immediately selects or only highlights until commit. */
export type RadioGroupActivationMode = "automatic" | "manual";
/** Boundary reached by non-wrapping radio navigation. */
export type RadioGroupBoundaryDirection = "previous" | "next";
/** Direction emitted by radiogroup navigation callbacks. */
export type RadioGroupNavigationDirection = "previous" | "next" | "first" | "last";

const RADIO_PREVIOUS_KEYS = ["ArrowUp", "ArrowLeft"] as const;
const RADIO_NEXT_KEYS = ["ArrowDown", "ArrowRight"] as const;

function getRadioNavigationDirection(key: string): RadioGroupNavigationDirection | null {
  if (key === "ArrowUp" || key === "ArrowLeft") return "previous";
  if (key === "ArrowDown" || key === "ArrowRight") return "next";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

interface SelectableCollectionItem {
  value: string;
}

export interface UseRadioGroupNavigationOptions<TValue extends string = string> {
  containerRef: RefObject<HTMLDivElement | null>;
  items: SelectableCollectionItem[];
  value: string | undefined;
  highlightedValue: string | null;
  enabledValues: string[];
  activationMode: RadioGroupActivationMode;
  keyboardNavigation: boolean;
  isDisabled: boolean;
  wrap: boolean;
  onNavigationBoundaryReached?: (
    direction: RadioGroupBoundaryDirection,
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  onNavigate?: (value: TValue, direction: RadioGroupNavigationDirection) => void;
  onEnter?: (value: TValue, event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  setHighlightedValue: (next: string | null) => void;
  invalidatePendingReset: () => void;
  setRequiredInvalid: (invalid: boolean) => void;
  setValue: (next: string) => void;
  handleValueChange: (next: string) => void;
}

/** APG keyboard navigation, activation mode, and tab-target derivation for RadioGroup. */
export function useRadioGroupNavigation<TValue extends string = string>({
  containerRef,
  items,
  value,
  highlightedValue,
  enabledValues,
  activationMode,
  keyboardNavigation,
  isDisabled,
  wrap,
  onNavigationBoundaryReached,
  onNavigate,
  onEnter,
  onKeyDown,
  setHighlightedValue,
  invalidatePendingReset,
  setRequiredInvalid,
  setValue,
  handleValueChange,
}: UseRadioGroupNavigationOptions<TValue>) {
  const navigationEventRef = useRef<ReactKeyboardEvent<HTMLDivElement> | null>(null);

  const preferredTabValues =
    activationMode === "manual" ? [highlightedValue, value] : [value, highlightedValue];
  const tabTargetValue =
    preferredTabValues.find(
      (candidate): candidate is string =>
        candidate !== null && candidate !== undefined && enabledValues.includes(candidate),
    ) ??
    enabledValues[0] ??
    null;

  const handleNavigatedItem = (next: string | null) => {
    if (next === null) return;
    setHighlightedValue(next);
    setRequiredInvalid(false);

    const direction = getRadioNavigationDirection(navigationEventRef.current?.key ?? "");
    if (direction !== null) {
      warnUnregisteredValue(
        "RadioGroup",
        next,
        items.map((item) => item.value),
      );
      onNavigate?.(next as TValue, direction);
    }

    if (activationMode === "automatic") {
      invalidatePendingReset();
      setValue(next);
    }
  };

  const handleNavigationEnter = (next: string) => {
    const event = navigationEventRef.current;
    if (!event) return;

    setHighlightedValue(next);
    handleValueChange(next);
    warnUnregisteredValue(
      "RadioGroup",
      next,
      items.map((item) => item.value),
    );
    onEnter?.(next as TValue, event);
  };

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "radio",
    highlighted: tabTargetValue,
    onHighlightChange: handleNavigatedItem,
    onEnter: handleNavigationEnter,
    wrap,
    enabled: keyboardNavigation && !isDisabled,
    moveFocus: true,
    scopeToContainer: true,
    upKeys: RADIO_PREVIOUS_KEYS,
    downKeys: RADIO_NEXT_KEYS,
    onNavigationBoundaryReached,
  });

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const eventTarget = isHTMLElementForContainer(event.target, containerRef.current)
      ? event.target
      : null;
    if (eventTarget && eventTarget.closest('[role="radiogroup"]') !== containerRef.current) {
      return;
    }

    onKeyDown?.(event);
    if (event.defaultPrevented || !keyboardNavigation || isDisabled) return;

    navigationEventRef.current = event;
    try {
      navKeyDown(event);
    } finally {
      navigationEventRef.current = null;
    }
  };

  return {
    tabTargetValue,
    handleKeyDown,
  };
}
