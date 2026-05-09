"use client";

import { useCallback } from "react";
import {
  useNavigationCore,
  type UseNavigationOptions,
} from "./use-navigation.js";
import type { RefObject } from "react";
import { useKey } from "./use-key.js";
import { keys } from "../utils/keys.js";
import { resolveDirectionKeys, dispatchNavigationKey } from "./internal/navigation-dispatch.js";
import { useKeyboardRegistryContext } from "../context/keyboard-context.js";

export type UseScopedNavigationOptions = Omit<UseNavigationOptions, "containerRef"> & {
  containerRef: RefObject<HTMLElement | null>;
  focusWithinOnly?: boolean;
  scope?: string;
};

export interface UseScopedNavigationReturn {
  highlighted: string | null;
  isHighlighted: (value: string) => boolean;
  highlight: (value: string) => void;
}

export function useScopedNavigation(options: UseScopedNavigationOptions): UseScopedNavigationReturn {
  useKeyboardRegistryContext();

  const {
    enabled = true,
    preventDefault = true,
    focusWithinOnly,
    orientation = "vertical",
    upKeys,
    downKeys,
    containerRef,
    moveFocus,
    scope,
  } = options;
  const resolvedFocusWithinOnly = focusWithinOnly ?? false;

  const { resolvedUpKeys, resolvedDownKeys } = resolveDirectionKeys(orientation, upKeys, downKeys);

  const { highlighted, isHighlighted, highlight, move, focusIndex, handleSelect, handleEnter, getElements } =
    useNavigationCore({ ...options, containerRef });

  const dispatch = useCallback((key: string, nativeEvent: globalThis.KeyboardEvent) => {
    dispatchNavigationKey(key, {
      resolvedUpKeys,
      resolvedDownKeys,
      move,
      focusIndex,
      handleSelect: moveFocus ? undefined : (e) => handleSelect(e),
      handleEnter: moveFocus ? undefined : (e) => handleEnter(e),
      total: getElements().length,
      nativeEvent,
    });
  }, [focusIndex, getElements, handleEnter, handleSelect, move, moveFocus, resolvedDownKeys, resolvedUpKeys]);

  const handlers: Record<string, (event: globalThis.KeyboardEvent) => void> = {
    ...keys(resolvedUpKeys, (e) => dispatch(e.key, e)),
    ...keys(resolvedDownKeys, (e) => dispatch(e.key, e)),
    Home: (e) => dispatch("Home", e),
    End: (e) => dispatch("End", e),
  };

  if (!moveFocus) {
    handlers.Enter = (e) => dispatch("Enter", e);
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
