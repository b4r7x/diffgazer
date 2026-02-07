import { useState, type RefObject, type KeyboardEvent } from "react";

type NavigationRole = "radio" | "checkbox" | "option" | "menuitem";

export interface NavigableHandle {
  focusNext: () => void;
  focusPrevious: () => void;
  focusFirst: () => void;
  focusLast: () => void;
  selectFocused: () => void;
  getFocusedValue: () => string | null;
}

interface UseLocalNavigationOptions {
  containerRef: RefObject<HTMLElement | null>;
  role: NavigationRole;
  value?: string | null;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  onEnter?: (value: string) => void;
  onFocusChange?: (value: string) => void;
  wrap?: boolean;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  initialValue?: string | null;
}

interface UseLocalNavigationReturn {
  focusedValue: string | null;
  isFocused: (value: string) => boolean;
  focus: (value: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  handle: NavigableHandle;
}

export function useLocalNavigation({
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
}: UseLocalNavigationOptions): UseLocalNavigationReturn {
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

  const onKeyDown = (event: KeyboardEvent) => {
    if (!enabled) return;

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "Home":
        event.preventDefault();
        focusIndex(0);
        break;
      case "End": {
        event.preventDefault();
        const elements = getElements();
        if (elements.length > 0) {
          focusIndex(elements.length - 1);
        }
        break;
      }
      case "Enter":
        event.preventDefault();
        if (focusedValue) {
          onEnter ? onEnter(focusedValue) : onSelect?.(focusedValue);
        }
        break;
      case " ":
        event.preventDefault();
        handleSelect();
        break;
    }
  };

  const isFocused = (v: string) => focusedValue === v;

  const focus = (v: string) => {
    setFocusedValue(v);
  };

  const handle: NavigableHandle = {
    focusNext: () => move(1),
    focusPrevious: () => move(-1),
    focusFirst: () => focusIndex(0),
    focusLast: () => {
      const elements = getElements();
      if (elements.length > 0) {
        focusIndex(elements.length - 1);
      }
    },
    selectFocused: handleSelect,
    getFocusedValue: () => focusedValue,
  };

  return {
    focusedValue,
    isFocused,
    focus,
    onKeyDown,
    handle,
  };
}
