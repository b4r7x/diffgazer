"use client";

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

export type NavigationRole =
  | "radio"
  | "checkbox"
  | "option"
  | "menuitem"
  | "menuitemradio"
  | "button"
  | "tab";

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
  onBoundaryReached?: (direction: "up" | "down") => void;
  initialValue?: string | null;
  upKeys?: string[];
  downKeys?: string[];
  orientation?: "vertical" | "horizontal";
  skipDisabled?: boolean;
  moveFocus?: boolean;
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

function resolveDirectionKeys(
  orientation: "vertical" | "horizontal",
  upKeys?: string[],
  downKeys?: string[],
): { resolvedUpKeys: string[]; resolvedDownKeys: string[] } {
  return {
    resolvedUpKeys: upKeys ?? (orientation === "vertical" ? ["ArrowUp"] : ["ArrowLeft"]),
    resolvedDownKeys: downKeys ?? (orientation === "vertical" ? ["ArrowDown"] : ["ArrowRight"]),
  };
}

function dispatchNavigationKey(
  key: string,
  ctx: {
    resolvedUpKeys: string[];
    resolvedDownKeys: string[];
    move: (dir: 1 | -1) => void;
    focusIndex: (i: number) => void;
    handleSelect?: (event: globalThis.KeyboardEvent) => void;
    handleEnter?: (event: globalThis.KeyboardEvent) => void;
    total: number;
    nativeEvent: globalThis.KeyboardEvent;
  },
): boolean {
  if (ctx.resolvedUpKeys.includes(key)) {
    ctx.move(-1);
    return true;
  }

  if (ctx.resolvedDownKeys.includes(key)) {
    ctx.move(1);
    return true;
  }

  switch (key) {
    case "Home":
      ctx.focusIndex(0);
      return true;
    case "End":
      if (ctx.total > 0) ctx.focusIndex(ctx.total - 1);
      return true;
    case "Enter":
      ctx.handleEnter?.(ctx.nativeEvent);
      return true;
    case " ":
      ctx.handleSelect?.(ctx.nativeEvent);
      return true;
  }

  return false;
}

const navigationItemDataAttributes = [
  "data-diffgazer-navigation-item",
  "data-navigation-item",
] as const;

function disabledSelector(skipDisabled: boolean): string {
  return skipDisabled
    ? ':not([aria-disabled="true"]):not([data-disabled]):not(:disabled)'
    : "";
}

function findElements(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

function queryFirstMatchingGroup(container: HTMLElement, selectors: string[]): HTMLElement[] {
  for (const selector of selectors) {
    const elements = findElements(container, selector);
    if (elements.length > 0) return elements;
  }
  return [];
}

function buildNavigationSelectors(role: NavigationRole, skipDisabled: boolean): string[] {
  const disabled = disabledSelector(skipDisabled);
  const dataContractSelectors = navigationItemDataAttributes.flatMap((attribute) => [
    `[${attribute}="${role}"][data-value]${disabled}`,
    `[${attribute}="true"][data-value]${disabled}`,
    `[${attribute}=""][data-value]${disabled}`,
    `[${attribute}][data-value]${disabled}`,
  ]);

  return [
    dataContractSelectors.join(","),
    `[role="${role}"][data-value]${disabled}`,
    `[data-value]${disabled}`,
    `[role="${role}"]${disabled}`,
  ];
}

function queryElements(
  containerRef: RefObject<HTMLElement | null>,
  role: NavigationRole,
  skipDisabled: boolean,
): HTMLElement[] {
  if (!containerRef.current) return [];
  return queryFirstMatchingGroup(
    containerRef.current,
    buildNavigationSelectors(role, skipDisabled),
  );
}

function wrapIndex(index: number, length: number, wrap: boolean): number | null {
  if (index < 0) return wrap ? length - 1 : null;
  if (index >= length) return wrap ? 0 : null;
  return index;
}

function containsActiveElement(el: HTMLElement): boolean {
  const activeElement = el.ownerDocument.activeElement;
  return activeElement instanceof HTMLElement && el.contains(activeElement);
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
  onBoundaryReached,
  initialValue = null,
  skipDisabled = true,
  moveFocus = false,
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
    () => queryElements(containerRef, role, skipDisabled),
    [containerRef, role, skipDisabled],
  );

  const getFocusedIndex = useCallback((): number => {
    const elements = getElements();
    if (elements.length === 0) return -1;

    if (highlighted) {
      const index = elements.findIndex((el) => el.dataset.value === highlighted);
      if (index >= 0) return index;
    }

    return elements.findIndex(containsActiveElement);
  }, [getElements, highlighted]);

  const focusIndexRef = useRef<((index: number) => void) | undefined>(undefined);
  focusIndexRef.current = (index: number) => {
    const elements = getElements();
    const el = elements[index];
    if (!el?.dataset.value) return;

    el.scrollIntoView?.({ block: "nearest" });
    if (moveFocus) el.focus();
    setFocusedValue(el.dataset.value);
  };

  const focusIndex = useCallback((index: number) => {
    focusIndexRef.current?.(index);
  }, []);

  const moveRef = useRef<((delta: 1 | -1) => void) | undefined>(undefined);
  moveRef.current = (delta: 1 | -1) => {
    const elements = getElements();
    if (elements.length === 0) return;

    const current = getFocusedIndex();
    const next = wrapIndex(current + delta, elements.length, wrap);
    if (next === null) {
      onBoundaryReached?.(delta < 0 ? "up" : "down");
      return;
    }

    focusIndexRef.current?.(next);
  };

  const move = useCallback((delta: 1 | -1) => {
    moveRef.current?.(delta);
  }, []);

  const handleSelect = useCallback((event: globalThis.KeyboardEvent) => {
    if (highlighted) onSelect?.(highlighted, event);
  }, [highlighted, onSelect]);

  const handleEnter = useCallback((event: globalThis.KeyboardEvent) => {
    if (!highlighted) return;
    if (onEnter) onEnter(highlighted, event);
    else onSelect?.(highlighted, event);
  }, [highlighted, onEnter, onSelect]);

  const isHighlighted = useCallback((nextValue: string) => highlighted === nextValue, [highlighted]);
  const highlight = useCallback((nextValue: string) => setFocusedValue(nextValue), [setFocusedValue]);

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
  } = options;

  const { resolvedUpKeys, resolvedDownKeys } = resolveDirectionKeys(orientation, upKeys, downKeys);
  const { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements } =
    useNavigationCore(options);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const key = event.key;
    const isMoveKey = resolvedUpKeys.includes(key) || resolvedDownKeys.includes(key);
    const isSpecialKey = key === "Home" || key === "End" || (!moveFocus && (key === "Enter" || key === " "));
    if (!isMoveKey && !isSpecialKey) return;

    if (preventDefault) event.preventDefault();

    dispatchNavigationKey(key, {
      resolvedUpKeys,
      resolvedDownKeys,
      move,
      focusIndex,
      handleSelect: moveFocus ? undefined : (nativeEvent) => handleSelect(nativeEvent),
      handleEnter: moveFocus ? undefined : (nativeEvent) => handleEnter(nativeEvent),
      total: getElements().length,
      nativeEvent: event.nativeEvent,
    });
  }, [
    enabled,
    resolvedUpKeys,
    resolvedDownKeys,
    preventDefault,
    moveFocus,
    move,
    focusIndex,
    handleSelect,
    handleEnter,
    getElements,
  ]);

  return { highlighted, isHighlighted, highlight, onKeyDown };
}
