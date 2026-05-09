"use client";

import {
  useCallback,
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
  onNavigationBoundaryReached?: (direction: "previous" | "next") => void;
  initialValue?: string | null;
  upKeys?: string[];
  downKeys?: string[];
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

const VERTICAL_UP_KEYS = ["ArrowUp"];
const VERTICAL_DOWN_KEYS = ["ArrowDown"];
const HORIZONTAL_UP_KEYS = ["ArrowLeft"];
const HORIZONTAL_DOWN_KEYS = ["ArrowRight"];

function resolveDirectionKeys(
  orientation: "vertical" | "horizontal",
  upKeys?: string[],
  downKeys?: string[],
): { resolvedUpKeys: string[]; resolvedDownKeys: string[] } {
  return {
    resolvedUpKeys: upKeys ?? (orientation === "vertical" ? VERTICAL_UP_KEYS : HORIZONTAL_UP_KEYS),
    resolvedDownKeys: downKeys ?? (orientation === "vertical" ? VERTICAL_DOWN_KEYS : HORIZONTAL_DOWN_KEYS),
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

function queryFirstMatchingGroup(
  container: HTMLElement,
  selectors: string[],
  filter?: (element: HTMLElement) => boolean,
): HTMLElement[] {
  for (const selector of selectors) {
    const elements = filter
      ? findElements(container, selector).filter(filter)
      : findElements(container, selector);
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
  const nativeRoleSelectors: Partial<Record<NavigationRole, string[]>> = {
    button: [`button[data-value]${disabled}`],
    checkbox: [`input[type="checkbox"][data-value]${disabled}`],
    radio: [`input[type="radio"][data-value]${disabled}`],
  };

  return [
    dataContractSelectors.join(","),
    `[role="${role}"][data-value]${disabled}`,
    ...(nativeRoleSelectors[role] ?? []),
    `[role="${role}"]${disabled}`,
  ];
}

function ownerSelectorForRole(role: NavigationRole): string | null {
  switch (role) {
    case "radio":
      return '[role="radiogroup"]';
    case "checkbox":
      return '[role="group"]';
    case "option":
      return '[role="listbox"]';
    case "menuitem":
    case "menuitemradio":
      return '[role="menu"]';
    case "tab":
      return '[role="tablist"]';
    case "button":
      return null;
  }
}

function isOwnedByContainer(element: HTMLElement, container: HTMLElement, role: NavigationRole) {
  const ownerSelector = ownerSelectorForRole(role);
  if (!ownerSelector) return true;

  const owner = element.closest(ownerSelector);
  return owner === null || owner === container;
}

function queryElements(
  containerRef: RefObject<HTMLElement | null>,
  role: NavigationRole,
  skipDisabled: boolean,
  scopeToContainer: boolean,
  ownerSelector: string | null | undefined,
): HTMLElement[] {
  if (!containerRef.current) return [];
  const container = containerRef.current;
  const ownerFilter = scopeToContainer
    ? (element: HTMLElement) => {
        if (ownerSelector !== undefined) {
          const owner = ownerSelector === null ? null : element.closest(ownerSelector);
          return owner === null || owner === container;
        }
        return isOwnedByContainer(element, container, role);
      }
    : undefined;

  return queryFirstMatchingGroup(
    container,
    buildNavigationSelectors(role, skipDisabled),
    ownerFilter,
  );
}

function wrapIndex(index: number, length: number, wrap: boolean): number | null {
  if (index < 0) return wrap ? length - 1 : null;
  if (index >= length) return wrap ? 0 : null;
  return index;
}

function containsActiveElement(el: HTMLElement): boolean {
  const activeElement = el.ownerDocument.activeElement;
  const View = el.ownerDocument.defaultView;
  return Boolean(View && activeElement instanceof View.HTMLElement && el.contains(activeElement));
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
    () => queryElements(containerRef, role, skipDisabled, scopeToContainer, ownerSelector),
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
    const elements = getElements();
    const focusedItem = elements.find(containsActiveElement);
    if (focusedItem?.dataset.value !== undefined) return focusedItem.dataset.value;

    if (highlighted !== null) {
      return elements.some((el) => el.dataset.value === highlighted) ? highlighted : null;
    }

    return null;
  }, [getElements, highlighted]);

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
    const next = wrapIndex(current + delta, elements.length, wrap);
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
