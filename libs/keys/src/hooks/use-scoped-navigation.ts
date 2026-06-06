"use client";

import type { RefObject } from "react";
import { useCallback } from "react";
import { keys } from "../core/keys.js";
import { dispatchNavigationKey, resolveDirectionKeys } from "../core/navigation-dispatch.js";
import { useKeyboardRegistryContext } from "../providers/keyboard-context.js";
import { useKey } from "./use-key.js";
import {
  type UseNavigationOptions,
  useNavigationCore,
} from "./use-navigation.js";

export type UseScopedNavigationOptions<TValue extends string = string> = Omit<
  UseNavigationOptions<TValue>,
  "containerRef"
> & {
  containerRef: RefObject<HTMLElement | null>;
  focusWithinOnly?: boolean;
  scope?: string | null;
};

export interface UseScopedNavigationReturn<TValue extends string = string> {
  highlighted: TValue | null;
  isHighlighted: (value: TValue) => boolean;
  highlight: (value: TValue | null) => void;
}

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

  const { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements } =
    useNavigationCore({ ...options, containerRef });
  const handlesEnter = Boolean(onEnter || onSelect);
  const handlesSpace = Boolean(onSelect);

  // Editable-target filtering is handled by the keyboard provider via `allowInInput`.
  const dispatch = useCallback((key: string, nativeEvent: globalThis.KeyboardEvent) => {
    dispatchNavigationKey(key, {
      resolvedUpKeys,
      resolvedDownKeys,
      move: (delta) => move(delta, nativeEvent, key),
      focusIndex,
      handleSelect: handlesSpace ? (e) => handleSelect(e) : undefined,
      handleEnter: handlesEnter ? (e) => handleEnter(e) : undefined,
      total: getElements().length,
      nativeEvent,
    });
  }, [focusIndex, getElements, handleEnter, handleSelect, handlesEnter, handlesSpace, move, resolvedDownKeys, resolvedUpKeys]);

  const handlers: Record<string, (event: globalThis.KeyboardEvent) => void> = {
    ...keys(resolvedUpKeys, (e) => dispatch(e.key, e)),
    ...keys(resolvedDownKeys, (e) => dispatch(e.key, e)),
    Home: (e) => dispatch("Home", e),
    End: (e) => dispatch("End", e),
  };

  if (handlesEnter) {
    handlers.Enter = (e) => dispatch("Enter", e);
  }
  if (handlesSpace) {
    handlers[" "] = (e) => dispatch(" ", e);
  }

  useKey(
    handlers,
    {
      enabled,
      preventDefault,
      containerRef,
      focusWithinOnly: resolvedFocusWithinOnly,
      scope,
    },
  );

  return { highlighted, isHighlighted, highlight };
}
