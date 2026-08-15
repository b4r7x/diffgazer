"use client";

import { useState } from "react";
import { containsActiveElement } from "../../dom/focusable.js";
import {
  getFocusedNavigationValue,
  getNavigationItems,
  type NavigationItemQuery,
} from "../../dom/navigation-items.js";
import type { UseNavigationOptions } from "../use-navigation.js";

export type UseNavigationCoreOptions<TValue extends string = string> = Omit<
  UseNavigationOptions<TValue>,
  "enabled" | "preventDefault" | "orientation" | "upKeys" | "downKeys"
>;

export interface UseNavigationCoreReturn<TValue extends string = string> {
  highlighted: TValue | null;
  isHighlighted: (value: TValue) => boolean;
  highlight: (value: TValue | null) => void;
  /**
   * A caller that already discovered the items for this event passes them as
   * `knownElements`, so one key event queries the DOM once. Omit them and the
   * move discovers the list itself, which is what a later event must do.
   */
  move: (
    delta: 1 | -1,
    event?: globalThis.KeyboardEvent,
    key?: string,
    knownElements?: HTMLElement[],
  ) => void;
  focusIndex: (index: number, knownElements?: HTMLElement[]) => boolean;
  handleSelect: (event: globalThis.KeyboardEvent) => void;
  handleEnter: (event: globalThis.KeyboardEvent) => void;
  getElements: () => HTMLElement[];
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
  itemSelector,
}: UseNavigationCoreOptions<TValue>): UseNavigationCoreReturn<TValue> {
  const [internalHighlighted, setInternalHighlighted] = useState<TValue | null>(defaultHighlighted);
  const isControlled = controlledHighlighted !== undefined;
  const highlighted = isControlled ? (controlledHighlighted ?? null) : internalHighlighted;
  const itemQuery: NavigationItemQuery = {
    type: role,
    skipDisabled,
    scopeToContainer,
    ownerSelector,
    itemSelector,
  };

  const setFocusedValue = (nextValue: TValue | null) => {
    if (!isControlled) setInternalHighlighted(nextValue);
    onHighlightChange?.(nextValue);
  };

  const getElements = () => getNavigationItems(containerRef.current, itemQuery);

  const getFocusedIndex = (knownElements?: HTMLElement[]): number => {
    const elements = knownElements ?? getElements();
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
    const focusedValue = getFocusedNavigationValue(containerRef.current, itemQuery);
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

  const move = (
    delta: 1 | -1,
    event?: globalThis.KeyboardEvent,
    key?: string,
    knownElements?: HTMLElement[],
  ) => {
    const elements = knownElements ?? getElements();
    if (elements.length === 0) return;

    const current = getFocusedIndex(elements);
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
