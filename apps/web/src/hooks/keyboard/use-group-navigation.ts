"use client";

import { useState, useCallback } from "react";
import { useKey } from "./use-key";

type NavigationRole = "radio" | "checkbox" | "option" | "menuitem";

interface UseGroupNavigationOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  role: NavigationRole;
  onSelect?: (value: string) => void;
  onEnter?: (value: string) => void;
  onFocusChange?: (value: string) => void;
  wrap?: boolean;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  initialValue?: string | null;
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
  onSelect,
  onEnter,
  onFocusChange,
  wrap = true,
  enabled = true,
  onBoundaryReached,
  initialValue = null,
}: UseGroupNavigationOptions): UseGroupNavigationReturn {
  const [focusedValue, setFocusedValue] = useState<string | null>(initialValue);

  const getElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        `[role="${role}"]:not([aria-disabled="true"])`
      )
    );
  }, [containerRef, role]);

  const getFocusedIndex = useCallback(() => {
    const elements = getElements();
    if (!focusedValue) return 0;
    const idx = elements.findIndex((el) => el.dataset.value === focusedValue);
    return idx >= 0 ? idx : 0;
  }, [getElements, focusedValue]);

  const focusIndex = useCallback(
    (index: number) => {
      const elements = getElements();
      const el = elements[index];
      if (el?.dataset.value) {
        setFocusedValue(el.dataset.value);
        onFocusChange?.(el.dataset.value);
      }
    },
    [getElements, onFocusChange]
  );

  const move = useCallback(
    (delta: 1 | -1) => {
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
    },
    [getElements, getFocusedIndex, focusIndex, wrap, onBoundaryReached]
  );

  const handleSelect = useCallback(() => {
    if (focusedValue) {
      onSelect?.(focusedValue);
    }
  }, [focusedValue, onSelect]);

  useKey("ArrowUp", () => move(-1), { enabled });
  useKey("ArrowDown", () => move(1), { enabled });
  useKey("Enter", () => {
    if (focusedValue) {
      onEnter ? onEnter(focusedValue) : onSelect?.(focusedValue);
    }
  }, { enabled });
  useKey(" ", handleSelect, { enabled });

  const isFocused = useCallback(
    (value: string) => focusedValue === value,
    [focusedValue]
  );

  const focus = useCallback(
    (value: string) => {
      setFocusedValue(value);
      onFocusChange?.(value);
    },
    [onFocusChange]
  );

  return {
    focusedValue,
    isFocused,
    focus,
  };
}
