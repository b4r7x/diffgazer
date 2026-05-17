"use client";

import { useCallback } from "react";
import {
  useNavigationCore,
  type UseNavigationOptions,
} from "./use-navigation.js";
import type { RefObject } from "react";
import { useKey } from "./use-key.js";
import { keys } from "../core/keys.js";
import { resolveDirectionKeys, dispatchNavigationKey } from "../core/navigation-dispatch.js";
import { useKeyboardRegistryContext } from "../context/keyboard-context.js";

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

/**
 * Like `useNavigation`, but bindings flow through the active `KeyboardProvider`
 * scope instead of a local `onKeyDown` handler.
 *
 * Use this when the navigation container needs to share keyboard precedence
 * with sibling scopes (popovers, dialogs, command palettes), or when the
 * list lives inside a portal where wiring `onKeyDown` is awkward. Requires a
 * `KeyboardProvider` ancestor and throws otherwise.
 *
 * @example
 * ```tsx
 * function CommandList({ items }: { items: { id: string; label: string }[] }) {
 *   const listRef = useRef<HTMLUListElement>(null);
 *   const { highlighted } = useScopedNavigation({
 *     containerRef: listRef,
 *     role: "option",
 *     scope: "command-palette",
 *     focusWithinOnly: true,
 *     onSelect: (id) => runCommand(id),
 *   });
 *   return (
 *     <ul ref={listRef} role="listbox">
 *       {items.map((item) => (
 *         <li
 *           key={item.id}
 *           role="option"
 *           data-nav-item="option"
 *           data-value={item.id}
 *           aria-selected={highlighted === item.id}
 *         >
 *           {item.label}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
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
