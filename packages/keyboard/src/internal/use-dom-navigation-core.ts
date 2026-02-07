import { useState, type RefObject } from "react";
import type { NavigationRole } from "../types";

export interface UseDomNavigationCoreOptions {
  containerRef: RefObject<HTMLElement | null>;
  role: NavigationRole;
  value?: string | null;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  onEnter?: (value: string) => void;
  onFocusChange?: (value: string) => void;
  wrap?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  initialValue?: string | null;
}

export interface UseDomNavigationCoreReturn {
  focusedValue: string | null;
  isFocused: (value: string) => boolean;
  focus: (value: string) => void;
  move: (delta: 1 | -1) => void;
  focusIndex: (index: number) => void;
  handleSelect: () => void;
  handleEnter: () => void;
  getElements: () => HTMLElement[];
}

export function useDomNavigationCore({
  containerRef,
  role,
  value,
  onValueChange,
  onSelect,
  onEnter,
  onFocusChange,
  wrap = true,
  onBoundaryReached,
  initialValue = null,
}: UseDomNavigationCoreOptions): UseDomNavigationCoreReturn {
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

  const handleEnter = () => {
    if (focusedValue) {
      onEnter ? onEnter(focusedValue) : onSelect?.(focusedValue);
    }
  };

  const isFocused = (v: string) => focusedValue === v;

  const focus = (v: string) => {
    setFocusedValue(v);
  };

  return {
    focusedValue,
    isFocused,
    focus,
    move,
    focusIndex,
    handleSelect,
    handleEnter,
    getElements,
  };
}
