"use client";

import { dispatchNavigationKey, resolveDirectionKeys } from "../core/navigation-dispatch.js";
import type { KeyHandler } from "../core/normalize-key-input.js";
import { DECLINE } from "../core/normalize-key-input.js";
import { useKeyboardRegistryContext } from "../providers/keyboard-context.js";
import { useKey } from "./use-key.js";
import { type UseNavigationOptions, useNavigationCore } from "./use-navigation.js";

/** Options for provider-backed, scope-aware role-based navigation. */
export interface UseScopedNavigationOptions<TValue extends string = string>
  extends UseNavigationOptions<TValue> {
  /** Only handle navigation keys when focus is within the container element. */
  focusWithinOnly?: boolean;
  /** Keyboard scope name to register navigation handlers under; null skips registration. */
  scope?: string | null;
}

/** Return value from `useScopedNavigation`. */
export interface UseScopedNavigationReturn<TValue extends string = string> {
  /** The value of the currently highlighted item, or null. */
  highlighted: TValue | null;
  /** Returns true if the given value is the highlighted item. */
  isHighlighted: (value: TValue) => boolean;
  /** Imperatively set the highlighted item. Pass null to clear. */
  highlight: (value: TValue | null) => void;
}

/**
 * Registers role-based list navigation through `KeyboardProvider` so movement
 * participates in the active scope stack.
 */
export function useScopedNavigation<TValue extends string = string>(
  options: UseScopedNavigationOptions<TValue>,
): UseScopedNavigationReturn<TValue> {
  // Provider-presence assertion. The dispatch path below relies on `useKey`,
  // which would silently no-op without a provider; calling the registry
  // context here throws early with a clear message instead.
  useKeyboardRegistryContext();

  const {
    enabled = true,
    preventDefault = true,
    focusWithinOnly,
    orientation = "vertical",
    upKeys,
    downKeys,
    containerRef,
    scope,
    onEnter,
    onSelect,
  } = options;
  const resolvedFocusWithinOnly = focusWithinOnly ?? false;

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
  } = useNavigationCore({ ...options, containerRef });
  const handlesEnter = Boolean(onEnter || onSelect);
  const handlesSpace = Boolean(onSelect);

  // Editable-target filtering is handled by the keyboard provider via `allowInInput`.
  const dispatch = (key: string, nativeEvent: globalThis.KeyboardEvent) => {
    const total = getElements().length;
    if (total === 0) return DECLINE;

    return dispatchNavigationKey(key, {
      resolvedUpKeys,
      resolvedDownKeys,
      move: (delta) => move(delta, nativeEvent, key),
      focusIndex,
      handleSelect: handlesSpace ? (e) => handleSelect(e) : undefined,
      handleEnter: handlesEnter ? (e) => handleEnter(e) : undefined,
      total,
      nativeEvent,
    });
  };

  const handlers: Record<string, KeyHandler> = {
    ...Object.fromEntries(
      resolvedUpKeys.map((key) => [key, (event: globalThis.KeyboardEvent) => dispatch(key, event)]),
    ),
    ...Object.fromEntries(
      resolvedDownKeys.map((key) => [
        key,
        (event: globalThis.KeyboardEvent) => dispatch(key, event),
      ]),
    ),
    Home: (e) => dispatch("Home", e),
    End: (e) => dispatch("End", e),
  };

  if (handlesEnter) {
    handlers.Enter = (e) => dispatch("Enter", e);
  }
  if (handlesSpace) {
    handlers[" "] = (e) => dispatch(" ", e);
  }

  useKey(handlers, {
    enabled,
    preventDefault,
    containerRef,
    focusWithinOnly: resolvedFocusWithinOnly,
    scope,
  });

  return { highlighted, isHighlighted, highlight };
}
