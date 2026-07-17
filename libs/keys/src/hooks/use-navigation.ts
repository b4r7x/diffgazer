"use client";

import { type KeyboardEvent, type RefObject, useState } from "react";
import { dispatchNavigationKey, resolveDirectionKeys } from "../core/navigation-dispatch.js";
import {
  composedContains,
  getComposedEventTarget,
  getOwnerView,
  isEditableElement,
  isNode,
} from "../dom/element-guards.js";
import { containsActiveElement } from "../dom/focusable.js";
import {
  getFocusedNavigationValue,
  getNavigationItems,
  type NavigationItemType,
} from "../dom/navigation-items.js";

/** ARIA role or data-contract item type used for navigation item discovery. */
export type NavigationRole = NavigationItemType;

/** Options for standalone role-based list navigation. */
export interface UseNavigationOptions<TValue extends string = string> {
  /** Ref to the container element holding navigable items. */
  containerRef: RefObject<HTMLElement | null>;
  /** ARIA role used to query navigable children within the container. */
  role: NavigationRole;
  /** Controlled highlight value. When provided, the hook operates in controlled mode. */
  highlighted?: TValue | null;
  /** Initial highlighted value in uncontrolled mode. */
  defaultHighlighted?: TValue | null;
  /** Called when the controlled highlight value should change. */
  onHighlightChange?: (value: TValue | null) => void;
  /** Called for Space selection and as the Enter fallback when onEnter is not provided. */
  onSelect?: (value: TValue, event: globalThis.KeyboardEvent) => void;
  /** Called for Enter selection, overriding the onSelect Enter fallback when provided. */
  onEnter?: (value: TValue, event: globalThis.KeyboardEvent) => void;
  /** Wrap around when reaching the first or last item. */
  wrap?: boolean;
  /** Whether the navigation hook is active. */
  enabled?: boolean;
  /** Call preventDefault() on handled keyboard events. */
  preventDefault?: boolean;
  /**
   * Called when the user tries to navigate past the first or last item.
   * Receives the direction, originating event, and key that hit the boundary.
   */
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  /** Custom key names to move highlight up or left. */
  upKeys?: readonly string[];
  /** Custom key names to move highlight down or right. */
  downKeys?: readonly string[];
  /** Navigation axis for default arrow keys. */
  orientation?: "vertical" | "horizontal";
  /** Skip aria-disabled, data-disabled, and native disabled items during navigation. */
  skipDisabled?: boolean;
  /**
   * Move DOM focus to the next item. When false, focus stays on the composite owner, which should
   * expose the highlighted option through aria-activedescendant.
   */
  moveFocus?: boolean;
  /** Ignore items owned by nested composite containers such as nested listboxes. */
  scopeToContainer?: boolean;
  /** Advanced owner selector override for roles without a standard composite owner. */
  ownerSelector?: string | null;
}

/** Return value from `useNavigation`. */
export interface UseNavigationReturn<TValue extends string = string> {
  /** The value of the currently highlighted item, or null. */
  highlighted: TValue | null;
  /** Returns true if the given value is the highlighted item. */
  isHighlighted: (value: TValue) => boolean;
  /** Imperatively set the highlighted item. Pass null to clear. */
  highlight: (value: TValue | null) => void;
  /** Keyboard event handler to attach to the container element. */
  onKeyDown: (event: KeyboardEvent) => void;
}

interface UseNavigationCoreReturn<TValue extends string = string> {
  highlighted: TValue | null;
  isHighlighted: (value: TValue) => boolean;
  highlight: (value: TValue | null) => void;
  move: (delta: 1 | -1, event?: globalThis.KeyboardEvent, key?: string) => void;
  focusIndex: (index: number) => boolean;
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

/**
 * Shared list-navigation state machine used by the standalone and provider-backed
 * navigation hooks.
 */
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
  const highlighted = isControlled ? (controlledHighlighted ?? null) : internalHighlighted;

  const setFocusedValue = (nextValue: TValue | null) => {
    if (!isControlled) setInternalHighlighted(nextValue);
    onHighlightChange?.(nextValue);
  };

  const getElements = () =>
    queryNavigationElements(containerRef, role, skipDisabled, scopeToContainer, ownerSelector);

  const getFocusedIndex = (): number => {
    const elements = getElements();
    if (elements.length === 0) return -1;

    const focusedIndex = elements.findIndex(containsActiveElement);
    if (focusedIndex >= 0) return focusedIndex;

    if (highlighted !== null) {
      const index = elements.findIndex((el) => el.dataset.value === highlighted);
      if (index >= 0) return index;
    }

    return -1;
  };

  const getCurrentValue = (): TValue | null => {
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
  };

  const focusIndex = (index: number, knownElements?: HTMLElement[]): boolean => {
    const elements = knownElements ?? getElements();
    const el = elements[index];
    if (!el) return false;
    const nextValue = el.dataset.value;
    if (nextValue === undefined) return false;

    el.scrollIntoView?.({ block: "nearest" });
    if (moveFocus) {
      el.focus();
      // Native disabled controls can't take DOM focus; report failure to step past.
      if (!containsActiveElement(el)) return false;
    }
    // DOM boundary: data-value is opaque to TS; consumers parameterize TValue.
    setFocusedValue(nextValue as TValue);
    return true;
  };

  const move = (delta: 1 | -1, event?: globalThis.KeyboardEvent, key?: string) => {
    const elements = getElements();
    if (elements.length === 0) return;

    const current = getFocusedIndex();
    let rawNext = current + delta;
    // Bounded by item count so an all-disabled wrap list can't loop forever.
    for (let attempts = 0; attempts < elements.length; attempts += 1) {
      const next = wrapIndex(rawNext, elements.length, wrap);
      if (next === null) {
        const direction = delta < 0 ? "previous" : "next";
        if (event && key) onNavigationBoundaryReached?.(direction, event, key);
        return;
      }
      if (next === current) return;
      if (focusIndex(next, elements)) return;
      if (!moveFocus) return;
      rawNext = next + delta;
    }
  };

  const handleSelect = (event: globalThis.KeyboardEvent) => {
    const currentValue = getCurrentValue();
    if (currentValue !== null) onSelect?.(currentValue, event);
  };

  const handleEnter = (event: globalThis.KeyboardEvent) => {
    const currentValue = getCurrentValue();
    if (currentValue === null) return;
    if (onEnter) onEnter(currentValue, event);
    else onSelect?.(currentValue, event);
  };

  const isHighlighted = (v: TValue) => highlighted === v;
  const highlight = (v: TValue | null) => setFocusedValue(v);

  return {
    highlighted,
    isHighlighted,
    highlight,
    move,
    focusIndex,
    handleSelect,
    handleEnter,
    getElements,
  };
}

/**
 * Adds standalone keyboard navigation, selection, and focus tracking to a
 * role-based list. Attach the returned `onKeyDown` handler to the container.
 */
export function useNavigation<TValue extends string = string>(
  options: UseNavigationOptions<TValue>,
): UseNavigationReturn<TValue> {
  const {
    containerRef,
    enabled = true,
    preventDefault = true,
    orientation = "vertical",
    upKeys,
    downKeys,
    onEnter,
    onSelect,
  } = options;

  const { resolvedUpKeys, resolvedDownKeys } = resolveDirectionKeys(orientation, upKeys, downKeys);

  const {
    highlighted,
    isHighlighted,
    highlight,
    move,
    focusIndex,
    handleSelect,
    handleEnter,
    getElements,
  } = useNavigationCore(options);
  const handlesEnter = Boolean(onEnter || onSelect);
  const handlesSpace = Boolean(onSelect);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (!enabled) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;
    const isMoveKey = resolvedUpKeys.includes(key) || resolvedDownKeys.includes(key);
    const isActivationKey = (key === "Enter" && handlesEnter) || (key === " " && handlesSpace);
    const isSpecialKey = key === "Home" || key === "End" || isActivationKey;
    if (!isMoveKey && !isSpecialKey) return;

    const elements = getElements();
    const target = getComposedEventTarget(event.nativeEvent);
    const isOwnItem =
      isNode(target, getOwnerView(containerRef.current)) &&
      elements.some((el) => composedContains(el, target));

    // Editable non-item bubbling into a wrapper that owns the items: let native handle it.
    if (isEditableElement(target)) {
      const currentTarget = event.currentTarget;
      const ownsItems =
        currentTarget != null &&
        elements.length > 0 &&
        elements.every((el) => currentTarget.contains(el));
      if (!isOwnItem && (ownsItems || elements.length === 0)) return;
    }

    // Don't swallow Enter/Space/Home/End for a non-navigation control beside the list.
    if (!isOwnItem) {
      const fromContainer = target === containerRef.current || target === event.currentTarget;
      const noItemToActOn = isActivationKey || elements.length === 0;
      if (!fromContainer && noItemToActOn) return;
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
  };

  return { highlighted, isHighlighted, highlight, onKeyDown };
}
