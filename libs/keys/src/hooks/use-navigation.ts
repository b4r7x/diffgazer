"use client";

import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useState,
} from "react";
import { dispatchNavigationKey, resolveDirectionKeys } from "../core/navigation-dispatch.js";
import { isEditableElement } from "../dom/element-guards.js";
import { containsActiveElement } from "../dom/focusable.js";
import {
  getFocusedNavigationValue,
  getNavigationItems,
  type NavigationItemType,
} from "../dom/navigation-items.js";

export type NavigationRole = NavigationItemType;

export interface UseNavigationOptions<TValue extends string = string> {
  containerRef: RefObject<HTMLElement | null>;
  role: NavigationRole;
  highlighted?: TValue | null;
  defaultHighlighted?: TValue | null;
  onHighlightChange?: (value: TValue | null) => void;
  onSelect?: (value: TValue, event: globalThis.KeyboardEvent) => void;
  onEnter?: (value: TValue, event: globalThis.KeyboardEvent) => void;
  wrap?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  upKeys?: readonly string[];
  downKeys?: readonly string[];
  orientation?: "vertical" | "horizontal";
  skipDisabled?: boolean;
  moveFocus?: boolean;
  scopeToContainer?: boolean;
  ownerSelector?: string | null;
}

export interface UseNavigationReturn<TValue extends string = string> {
  highlighted: TValue | null;
  isHighlighted: (value: TValue) => boolean;
  highlight: (value: TValue | null) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

interface UseNavigationCoreReturn<TValue extends string = string> {
  highlighted: TValue | null;
  isHighlighted: (value: TValue) => boolean;
  highlight: (value: TValue | null) => void;
  move: (delta: 1 | -1, event?: globalThis.KeyboardEvent, key?: string) => void;
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

export function useNavigationCore<TValue extends string = string>({
  containerRef,
  role,
  highlighted: controlledHighlighted,
  defaultHighlighted = null,
  onSelect,
  onEnter,
  onHighlightChange,
  wrap = true,
  onNavigationBoundaryReached,
  skipDisabled = true,
  moveFocus = false,
  scopeToContainer = true,
  ownerSelector,
}: UseNavigationOptions<TValue>): UseNavigationCoreReturn<TValue> {
  const [internalHighlighted, setInternalHighlighted] = useState<TValue | null>(defaultHighlighted);
  const isControlled = controlledHighlighted !== undefined;
  const highlighted = isControlled ? controlledHighlighted ?? null : internalHighlighted;

  const setFocusedValue = useCallback((nextValue: TValue | null) => {
    if (!isControlled) setInternalHighlighted(nextValue);
    onHighlightChange?.(nextValue);
  }, [isControlled, onHighlightChange]);

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

  const getCurrentValue = useCallback((): TValue | null => {
    const focusedValue = getFocusedNavigationValue(containerRef.current, {
      type: role,
      skipDisabled,
      scopeToContainer,
      ownerSelector,
    });
    // DOM boundary: data-value is opaque to TS; consumers parameterize TValue.
    if (focusedValue !== null) return focusedValue as TValue;

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
    // DOM boundary: data-value is opaque to TS; consumers parameterize TValue.
    setFocusedValue(nextValue as TValue);
  }, [getElements, moveFocus, setFocusedValue]);

  const move = useCallback((delta: 1 | -1, event?: globalThis.KeyboardEvent, key?: string) => {
    const elements = getElements();
    if (elements.length === 0) return;

    const current = getFocusedIndex();
    const rawNext = current + delta;
    const next = wrapIndex(rawNext, elements.length, wrap);
    if (next === null) {
      const direction = delta < 0 ? "previous" : "next";
      if (event && key) onNavigationBoundaryReached?.(direction, event, key);
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

  const isHighlighted = useCallback((v: TValue) => highlighted === v, [highlighted]);
  const highlight = useCallback((v: TValue | null) => setFocusedValue(v), [setFocusedValue]);

  return { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements };
}

export function useNavigation<TValue extends string = string>(
  options: UseNavigationOptions<TValue>,
): UseNavigationReturn<TValue> {
  const {
    enabled = true,
    preventDefault = true,
    orientation = "vertical",
    upKeys,
    downKeys,
    onEnter,
    onSelect,
  } = options;

  const { resolvedUpKeys, resolvedDownKeys } = resolveDirectionKeys(orientation, upKeys, downKeys);

  const { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements } =
    useNavigationCore(options);
  const handlesEnter = Boolean(onEnter || onSelect);
  const handlesSpace = Boolean(onSelect);

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

    const elements = getElements();

    // Editable target guard: when an editable element bubbles a key into a wrapper
    // that ALSO owns the navigation container, let the native control handle the key.
    // We only skip when:
    //   1) the event target is editable,
    //   2) the target is NOT itself a navigation item,
    //   3) currentTarget is an ancestor of the items (natural bubble case),
    //      so the user did not explicitly forward the event from the editable.
    if (isEditableElement(event.target)) {
      const target = event.target as HTMLElement;
      const isOwnItem = elements.some((el) => el === target || el.contains(target));
      const currentTarget = event.currentTarget;
      const ownsItems =
        currentTarget != null && elements.length > 0 && elements.every((el) => currentTarget.contains(el));
      if (!isOwnItem && ownsItems) return;
    }

    if (preventDefault) event.preventDefault();

    dispatchNavigationKey(key, {
      resolvedUpKeys,
      resolvedDownKeys,
      move: (delta) => move(delta, event.nativeEvent, key),
      focusIndex,
      handleSelect: handlesSpace ? (e) => handleSelect(e) : undefined,
      handleEnter: handlesEnter ? (e) => handleEnter(e) : undefined,
      total: elements.length,
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
