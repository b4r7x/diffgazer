import { useState, type RefObject } from "react";
import { useKey } from "./use-key";

type NavigationRole = "radio" | "checkbox" | "option" | "menuitem";

interface UseGroupNavigationOptions {
  containerRef: RefObject<HTMLElement | null>;
  role: NavigationRole;
  // Controlled mode - when value is provided, hook is controlled
  value?: string | null;
  onValueChange?: (value: string) => void;
  // Uncontrolled mode (for checkbox/radio backward compatibility)
  onSelect?: (value: string) => void;
  onEnter?: (value: string) => void;
  onFocusChange?: (value: string) => void;
  wrap?: boolean;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  initialValue?: string | null;
  requireFocusWithin?: boolean;
}

interface UseGroupNavigationReturn {
  focusedValue: string | null;
  isFocused: (value: string) => boolean;
  focus: (value: string) => void;
}

/**
 * DOM-based keyboard navigation for compound components.
 * Queries the DOM for elements with the specified role instead of
 * requiring Children.forEach extraction.
 *
 * Items must have:
 * - role attribute matching the role option
 * - data-value attribute with the item's value
 * - aria-disabled="true" if disabled
 */
export function useGroupNavigation({
  containerRef,
  role,
  value,
  onValueChange,
  onSelect,
  onEnter,
  onFocusChange,
  wrap = true,
  enabled = true,
  onBoundaryReached,
  initialValue = null,
  requireFocusWithin = false,
}: UseGroupNavigationOptions): UseGroupNavigationReturn {
  const [internalValue, setInternalValue] = useState<string | null>(initialValue);
  const isControlled = value !== undefined;
  const focusedValue = isControlled ? value ?? null : internalValue;

  const getElements = () => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        `[role="${role}"]:not([aria-disabled="true"])`
      )
    );
  };

  const getFocusedIndex = () => {
    const elements = getElements();
    if (!focusedValue) return 0;
    const idx = elements.findIndex((el) => el.dataset.value === focusedValue);
    return idx >= 0 ? idx : 0;
  };

  const setFocusedValue = (nextValue: string) => {
    if (isControlled) {
      onValueChange?.(nextValue);
      onFocusChange?.(nextValue);
      return;
    }
    setInternalValue(nextValue);
    onFocusChange?.(nextValue);
  };

  const focusIndex = (index: number) => {
    const elements = getElements();
    const el = elements[index];
    if (el?.dataset.value) {
      // jsdom and some non-browser environments do not implement scrollIntoView.
      el.scrollIntoView?.({ block: "nearest" });
      setFocusedValue(el.dataset.value);
    }
  };

  const move = (delta: 1 | -1) => {
    const elements = getElements();
    if (elements.length === 0) return;

    const current = getFocusedIndex();
    let next = current + delta;

    if (next < 0) {
      if (wrap) {
        next = elements.length - 1;
      } else {
        onBoundaryReached?.("up");
        return;
      }
    } else if (next >= elements.length) {
      if (wrap) {
        next = 0;
      } else {
        onBoundaryReached?.("down");
        return;
      }
    }

    focusIndex(next);
  };

  const handleSelect = () => {
    if (focusedValue) {
      onSelect?.(focusedValue);
    }
  };

  const keyOptions = {
    enabled,
    targetRef: containerRef,
    requireFocusWithin,
  } as const;

  useKey("ArrowUp", () => move(-1), keyOptions);
  useKey("ArrowDown", () => move(1), keyOptions);
  useKey("Home", () => focusIndex(0), keyOptions);
  useKey("End", () => {
    const elements = getElements();
    if (elements.length === 0) return;
    focusIndex(elements.length - 1);
  }, keyOptions);
  useKey("Enter", () => {
    if (focusedValue) {
      onEnter ? onEnter(focusedValue) : onSelect?.(focusedValue);
    }
  }, keyOptions);
  useKey(" ", handleSelect, keyOptions);

  const isFocused = (value: string) => focusedValue === value;

  const focus = (v: string) => {
    setFocusedValue(v);
  };

  return {
    focusedValue,
    isFocused,
    focus,
  };
}
