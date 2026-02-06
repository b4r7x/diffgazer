import { useState } from "react";
import { useKey } from "./use-key";

type NavigationRole = "radio" | "checkbox" | "option" | "menuitem";

interface UseGroupNavigationOptions {
  containerRef: React.RefObject<HTMLElement | null>;
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
}: UseGroupNavigationOptions): UseGroupNavigationReturn {
  const [internalValue, setInternalValue] = useState<string | null>(initialValue);
  const isControlled = value !== undefined;
  const focusedValue = isControlled ? value : internalValue;

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

  const focusIndex = (index: number) => {
    const elements = getElements();
    const el = elements[index];
    if (el?.dataset.value) {
      el.scrollIntoView({ block: 'nearest' });
      if (isControlled) {
        onValueChange?.(el.dataset.value);
      } else {
        setInternalValue(el.dataset.value);
        onFocusChange?.(el.dataset.value);
      }
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

  useKey("ArrowUp", () => move(-1), { enabled });
  useKey("ArrowDown", () => move(1), { enabled });
  useKey("Enter", () => {
    if (focusedValue) {
      onEnter ? onEnter(focusedValue) : onSelect?.(focusedValue);
    }
  }, { enabled });
  useKey(" ", handleSelect, { enabled });

  const isFocused = (value: string) => focusedValue === value;

  const focus = (v: string) => {
    if (isControlled) {
      onValueChange?.(v);
    } else {
      setInternalValue(v);
      onFocusChange?.(v);
    }
  };

  return {
    focusedValue,
    isFocused,
    focus,
  };
}
