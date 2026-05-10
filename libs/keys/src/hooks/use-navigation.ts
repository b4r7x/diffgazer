"use client";

import {
  useState,
  useCallback,
  type RefObject,
  type KeyboardEvent,
} from "react";
import { resolveDirectionKeys, dispatchNavigationKey } from "./internal/navigation-dispatch.js";
import {
  containsActiveElement,
  getFocusedNavigationValue,
  getNavigationItems,
  type NavigationItemType,
} from "../utils/navigation-items.js";

export type NavigationRole = NavigationItemType;

export interface UseNavigationOptions {
  containerRef: RefObject<HTMLElement | null>;
  role: NavigationRole;
  value?: string | null;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string, event: globalThis.KeyboardEvent) => void;
  onEnter?: (value: string, event: globalThis.KeyboardEvent) => void;
  onHighlightChange?: (value: string) => void;
  wrap?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
  onNavigationBoundaryReached?: (direction: "previous" | "next") => void;
  initialValue?: string | null;
  upKeys?: readonly string[];
  downKeys?: readonly string[];
  orientation?: "vertical" | "horizontal";
  skipDisabled?: boolean;
  moveFocus?: boolean;
  scopeToContainer?: boolean;
  ownerSelector?: string | null;
}

export interface UseNavigationReturn {
  highlighted: string | null;
  isHighlighted: (value: string) => boolean;
  highlight: (value: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

interface UseNavigationCoreReturn {
  highlighted: string | null;
  isHighlighted: (value: string) => boolean;
  highlight: (value: string) => void;
  move: (delta: 1 | -1) => void;
  focusIndex: (index: number) => void;
  handleSelect: (event: globalThis.KeyboardEvent) => void;
  handleEnter: (event: globalThis.KeyboardEvent) => void;
  getElements: () => HTMLElement[];
}

function queryNavigationElements(
  containerRef: RefObject<HTMLElement | null>,
  role: NavigationRole,
  skipDisabled: boolean,
  scopeToContainer: boolean,
  ownerSelector: string | null | undefined,
): HTMLElement[] {
  return getNavigationItems(containerRef.current, {
    type: role,
    skipDisabled,
    scopeToContainer,
    ownerSelector,
  });
}

function wrapIndex(index: number, length: number, wrap: boolean): number | null {
  if (index < 0) return wrap ? length - 1 : null;
  if (index >= length) return wrap ? 0 : null;
  return index;
}

export function useNavigationCore({
  containerRef,
  role,
  value,
  onValueChange,
  onSelect,
  onEnter,
  onHighlightChange,
  wrap = true,
  onNavigationBoundaryReached,
  initialValue = null,
  skipDisabled = true,
  moveFocus = false,
  scopeToContainer = true,
  ownerSelector,
}: UseNavigationOptions): UseNavigationCoreReturn {
  const [internalValue, setInternalValue] = useState<string | null>(initialValue);
  const isControlled = value !== undefined;
  const highlighted = isControlled ? value ?? null : internalValue;

  const setFocusedValue = useCallback((nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    onHighlightChange?.(nextValue);
  }, [isControlled, onValueChange, onHighlightChange]);

  const getElements = useCallback(
    () => queryNavigationElements(containerRef, role, skipDisabled, scopeToContainer, ownerSelector),
    [containerRef, role, skipDisabled, scopeToContainer, ownerSelector],
  );

  const getFocusedIndex = useCallback((): number => {
    const elements = getElements();
    if (elements.length === 0) return -1;

    const focusedIndex = elements.findIndex(containsActiveElement);
    if (focusedIndex >= 0) return focusedIndex;

    if (highlighted !== null) {
      const index = elements.findIndex((el) => el.dataset.value === highlighted);
      if (index >= 0) return index;
    }

    return -1;
  }, [getElements, highlighted]);

  const getCurrentValue = useCallback((): string | null => {
    const focusedValue = getFocusedNavigationValue(containerRef.current, {
      type: role,
      skipDisabled,
      scopeToContainer,
      ownerSelector,
    });
    if (focusedValue !== null) return focusedValue;

    const elements = getElements();

    if (highlighted !== null) {
      return elements.some((el) => el.dataset.value === highlighted) ? highlighted : null;
    }

    return null;
  }, [containerRef, getElements, highlighted, ownerSelector, role, scopeToContainer, skipDisabled]);

  const focusIndex = useCallback((index: number) => {
    const elements = getElements();
    const el = elements[index];
    if (!el) return;
    const nextValue = el.dataset.value;
    if (nextValue === undefined) return;

    el.scrollIntoView?.({ block: "nearest" });
    if (moveFocus) el.focus();
    setFocusedValue(nextValue);
  }, [getElements, moveFocus, setFocusedValue]);

  const move = useCallback((delta: 1 | -1) => {
    const elements = getElements();
    if (elements.length === 0) return;

    const current = getFocusedIndex();
    const rawNext = current + delta;
    const next = wrapIndex(rawNext, elements.length, wrap);
    if (next === null) {
      onNavigationBoundaryReached?.(delta < 0 ? "previous" : "next");
      return;
    }

    focusIndex(next);
  }, [focusIndex, getElements, getFocusedIndex, onNavigationBoundaryReached, wrap]);

  const handleSelect = useCallback((event: globalThis.KeyboardEvent) => {
    const currentValue = getCurrentValue();
    if (currentValue !== null) onSelect?.(currentValue, event);
  }, [getCurrentValue, onSelect]);

  const handleEnter = useCallback((event: globalThis.KeyboardEvent) => {
    const currentValue = getCurrentValue();
    if (currentValue === null) return;
    if (onEnter) onEnter(currentValue, event);
    else onSelect?.(currentValue, event);
  }, [getCurrentValue, onEnter, onSelect]);

  const isHighlighted = useCallback((v: string) => highlighted === v, [highlighted]);
  const highlight = useCallback((v: string) => setFocusedValue(v), [setFocusedValue]);

  return { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements };
}

export function useNavigation(options: UseNavigationOptions): UseNavigationReturn {
  const {
    enabled = true,
    preventDefault = true,
    orientation = "vertical",
    upKeys,
    downKeys,
    moveFocus = false,
    onEnter,
    onSelect,
  } = options;

  const { resolvedUpKeys, resolvedDownKeys } = resolveDirectionKeys(orientation, upKeys, downKeys);

  const { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements } =
    useNavigationCore(options);
  const handlesEnter = !moveFocus || Boolean(onEnter || onSelect);
  const handlesSpace = !moveFocus || Boolean(onSelect);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const key = event.key;
    const isMoveKey = resolvedUpKeys.includes(key) || resolvedDownKeys.includes(key);
    const isSpecialKey =
      key === "Home"
      || key === "End"
      || (key === "Enter" && handlesEnter)
      || (key === " " && handlesSpace);
    if (!isMoveKey && !isSpecialKey) return;

    if (preventDefault) event.preventDefault();

    dispatchNavigationKey(key, {
      resolvedUpKeys,
      resolvedDownKeys,
      move,
      focusIndex,
      handleSelect: handlesSpace ? (e) => handleSelect(e) : undefined,
      handleEnter: handlesEnter ? (e) => handleEnter(e) : undefined,
      total: getElements().length,
      nativeEvent: event.nativeEvent,
    });
  }, [
    enabled,
    resolvedUpKeys,
    resolvedDownKeys,
    preventDefault,
    handlesEnter,
    handlesSpace,
    move,
    focusIndex,
    handleSelect,
    handleEnter,
    getElements,
  ]);

  return { highlighted, isHighlighted, highlight, onKeyDown };
}
