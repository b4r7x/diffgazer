"use client";

import type { KeyboardEvent, RefObject } from "react";
import { dispatchNavigationKey, resolveDirectionKeys } from "../core/navigation-dispatch.js";
import {
  composedContains,
  getComposedEventTarget,
  getOwnerView,
  isEditableElement,
  isNode,
} from "../dom/element-guards.js";
import type { NavigationItemType } from "../dom/navigation-items.js";
import { useNavigationCore } from "./use-navigation/core.js";

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
