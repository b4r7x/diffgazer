"use client";

import { type RefCallback, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { containsActiveElement } from "../dom/focusable.js";
import { useFocusZone } from "./use-focus-zone.js";
import { type UseKeyOptions, useKey } from "./use-key.js";

type ActionRowZone = "content" | "actions";
const ACTION_ROW_ZONES = ["content", "actions"] as const;
const EMPTY_DISABLED: readonly boolean[] = [];

// Tuple-aware index narrowing. For a tuple like [a, b] this yields `0 | 1`;
// for `readonly unknown[]` (default) it stays `number`.
type ActionRowIndex<Actions extends readonly unknown[]> = number extends Actions["length"]
  ? number
  : {
      [K in keyof Actions]: K extends `${infer N extends number}` ? N : never;
    }[number];

// Tuple-aware disabled-flags shape. For a tuple it preserves length and
// per-position position; for arrays it stays `readonly boolean[]`.
type ActionRowDisabledFlags<Actions extends readonly unknown[]> = number extends Actions["length"]
  ? readonly boolean[]
  : { readonly [K in keyof Actions]: boolean };

/** Options for two-zone keyboard navigation across row content and inline actions. */
export interface UseActionRowNavigationOptions<
  Actions extends readonly unknown[] = readonly unknown[],
> {
  /** Enables row keyboard handling. Pass the row's active or selected state. */
  enabled: boolean;
  /** Number of action controls managed by the row. */
  actionCount: Actions["length"];
  /** Called when Enter or Space activates the focused action. */
  onAction: (index: ActionRowIndex<Actions>) => void;
  /** Per-index disabled flags; disabled actions are skipped and ignored on activation. */
  disabledActions?: ActionRowDisabledFlags<Actions>;
  /** Receives focus when entering actions but no action is enabled. */
  disabledFocusFallbackRef?: RefObject<HTMLElement | null>;
  /** Limits zone handling to one row subtree. */
  containerRef?: RefObject<HTMLElement | null>;
  /** Explicit keyboard scope for action-row shortcuts. Omit to use implicit scope ordering. */
  scope?: UseKeyOptions["scope"];
  /** Allow row shortcuts to run when an editable element is focused. */
  allowInInput?: boolean;
  /** Wrap ArrowLeft/ArrowRight movement across the action ends. */
  wrap?: boolean;
  /** Initial zone; `"actions"` focuses the default action on mount. */
  defaultZone?: ActionRowZone;
  /** Initial action index focused when entering the actions zone. */
  defaultIndex?: ActionRowIndex<Actions>;
  /** Allow ArrowUp to leave the actions zone back to content. */
  canExitActions?: boolean;
  /** Called when navigation lands on an action index. */
  onNavigate?: (index: ActionRowIndex<Actions>) => void;
  /** Called when navigation cannot move further in a direction. */
  onNavigationBoundaryReached?: (direction: "previous" | "next") => void;
}

function getDisabledKey(actionCount: number, disabledActions: readonly boolean[]): string {
  let key = "";
  for (let i = 0; i < actionCount; i += 1) {
    key += disabledActions[i] ? "1" : "0";
  }
  return key;
}

function isIndexEnabled(index: number, actionCount: number, disabledKey: string): boolean {
  return index >= 0 && index < actionCount && disabledKey[index] !== "1";
}

function getFirstEnabled(actionCount: number, disabledKey: string): number | null {
  for (let i = 0; i < actionCount; i += 1) {
    if (isIndexEnabled(i, actionCount, disabledKey)) return i;
  }
  return null;
}

function getNextIndex(
  current: number,
  direction: -1 | 1,
  actionCount: number,
  wrap: boolean,
  disabledKey: string,
): number | null {
  if (actionCount <= 0) return null;

  let next = current + direction;
  for (let attempts = 0; attempts < actionCount; attempts += 1) {
    if (next < 0 || next >= actionCount) {
      if (!wrap) return isIndexEnabled(current, actionCount, disabledKey) ? current : null;
      next = direction < 0 ? actionCount - 1 : 0;
    }
    if (isIndexEnabled(next, actionCount, disabledKey)) return next;
    next += direction;
  }

  return isIndexEnabled(current, actionCount, disabledKey) ? current : null;
}

/** Return value from `useActionRowNavigation`. */
export interface UseActionRowNavigationReturn<
  Actions extends readonly unknown[] = readonly unknown[],
> {
  /** Whether the row is currently in the actions zone. */
  inActions: boolean;
  /** Current focused action index. */
  focusedIndex: ActionRowIndex<Actions>;
  /** Whether the current action index is disabled. */
  isFocusedActionDisabled: boolean;
  /**
   * Moves into the actions zone and focuses the requested or first enabled
   * action. Returns the focused index, or null when no action is enabled.
   */
  enterActions: (index?: ActionRowIndex<Actions>) => number | null;
  /** Returns to the content zone when `canExitActions` is true. */
  exitActions: () => void;
  /** Returns to content and resets the focused action index. */
  reset: (initialIndex?: ActionRowIndex<Actions>) => void;
  /** Props to spread onto each action element so the hook can focus and track it. */
  getActionProps: (index: ActionRowIndex<Actions>) => {
    /** Ref callback that registers the action element at this index. */
    ref: RefCallback<HTMLElement>;
    /** Numeric action index exposed for debugging and tests. */
    "data-action-index": number;
    /** Focus handler that marks this action as the active action-zone item. */
    onFocus: () => void;
  };
}

/**
 * Coordinates a row's main content with a strip of inline action buttons using
 * provider-backed two-zone keyboard navigation.
 */
export function useActionRowNavigation<Actions extends readonly unknown[] = readonly unknown[]>({
  enabled,
  actionCount,
  onAction,
  disabledActions = EMPTY_DISABLED as ActionRowDisabledFlags<Actions>,
  disabledFocusFallbackRef,
  containerRef,
  scope,
  allowInInput = false,
  wrap = false,
  defaultZone = "content",
  defaultIndex = 0 as ActionRowIndex<Actions>,
  canExitActions = true,
  onNavigate,
  onNavigationBoundaryReached,
}: UseActionRowNavigationOptions<Actions>): UseActionRowNavigationReturn<Actions> {
  const [focusedIndex, setFocusedIndex] = useState<number>(defaultIndex);
  const actionRefs = useRef(new Map<number, HTMLElement>());
  const hasFocusedDefaultRef = useRef(false);
  const disabledKey = getDisabledKey(actionCount, disabledActions);

  const focusZone = useFocusZone<ActionRowZone>({
    initial: defaultZone,
    zones: ACTION_ROW_ZONES,
    enabled,
    scope,
    containerRef,
    focusWithinOnly: Boolean(containerRef),
    allowInInput,
  });
  const inActions = focusZone.isZone("actions");
  const setZone = focusZone.setZone;

  const getEnabledTargetIndex = useCallback(
    (index: number) => {
      return isIndexEnabled(index, actionCount, disabledKey)
        ? index
        : getFirstEnabled(actionCount, disabledKey);
    },
    [actionCount, disabledKey],
  );

  const focusAction = useCallback(
    (index: number) => {
      const targetIndex = getEnabledTargetIndex(index);
      if (targetIndex === null) return null;

      setFocusedIndex(targetIndex);
      actionRefs.current.get(targetIndex)?.focus();
      return targetIndex;
    },
    [getEnabledTargetIndex],
  );

  const focusDisabledFallback = useCallback(() => {
    const fallback = disabledFocusFallbackRef?.current;
    if (fallback) {
      fallback.focus({ preventScroll: true });
      return;
    }
    const focusedAction = actionRefs.current.get(focusedIndex);
    if (focusedAction && containsActiveElement(focusedAction)) focusedAction.blur();
  }, [disabledFocusFallbackRef, focusedIndex]);

  const isRegisteredActionFocused = useCallback(() => {
    const el = actionRefs.current.get(focusedIndex);
    return el ? containsActiveElement(el) : false;
  }, [focusedIndex]);

  const shouldRepairActionFocus = useCallback(() => {
    const firstAction = actionRefs.current.values().next().value;
    const ownerDocument =
      firstAction?.ownerDocument ??
      disabledFocusFallbackRef?.current?.ownerDocument ??
      containerRef?.current?.ownerDocument;
    if (!ownerDocument) return true;

    const activeElement = ownerDocument.activeElement;
    if (!activeElement || activeElement === ownerDocument.body) return true;

    for (const action of actionRefs.current.values()) {
      if (action === activeElement || action.contains(activeElement)) return true;
    }
    return false;
  }, [containerRef, disabledFocusFallbackRef]);

  useEffect(() => {
    if (!enabled || defaultZone !== "actions" || !inActions || hasFocusedDefaultRef.current) return;
    const targetIndex = getEnabledTargetIndex(defaultIndex);
    if (targetIndex === null) {
      setZone("content");
      focusDisabledFallback();
      hasFocusedDefaultRef.current = true;
      return;
    }
    if (!actionRefs.current.has(targetIndex)) return;

    focusAction(targetIndex);
    hasFocusedDefaultRef.current = true;
  }, [
    defaultIndex,
    defaultZone,
    enabled,
    focusAction,
    focusDisabledFallback,
    getEnabledTargetIndex,
    inActions,
    setZone,
  ]);

  useEffect(() => {
    if (!enabled || !inActions) return;
    if (!shouldRepairActionFocus()) return;
    if (isIndexEnabled(focusedIndex, actionCount, disabledKey)) {
      if (!isRegisteredActionFocused()) focusAction(focusedIndex);
      return;
    }
    const targetIndex = getFirstEnabled(actionCount, disabledKey);
    if (targetIndex === null) {
      setZone("content");
      focusDisabledFallback();
      return;
    }
    focusAction(targetIndex);
  }, [
    actionCount,
    disabledKey,
    enabled,
    focusAction,
    focusDisabledFallback,
    focusedIndex,
    inActions,
    isRegisteredActionFocused,
    setZone,
    shouldRepairActionFocus,
  ]);

  const reset = (initialIndex: number = 0) => {
    setZone("content");
    setFocusedIndex(initialIndex);
  };

  const enterActions = (index: number = 0) => {
    const targetIndex = getEnabledTargetIndex(index);
    if (targetIndex === null) {
      setZone("content");
      focusDisabledFallback();
      return null;
    }

    setZone("actions");
    focusAction(targetIndex);
    // targetIndex is bounded to 0..actionCount-1 by getEnabledTargetIndex,
    // so it is always a valid Actions index when Actions is a tuple.
    onNavigate?.(targetIndex as ActionRowIndex<Actions>);
    return targetIndex;
  };

  const exitActions = () => {
    if (!canExitActions) return;
    setZone("content");
    setFocusedIndex(0);
    onNavigationBoundaryReached?.("previous");
  };

  const keyOptions = focusZone.getKeyOptions("actions");
  const enterOptions = focusZone.getKeyOptions("content");

  const activateFocusedAction = (event: KeyboardEvent) => {
    if (!isIndexEnabled(focusedIndex, actionCount, disabledKey)) return;
    event.preventDefault();
    // focusedIndex is guarded by isIndexEnabled (0..actionCount-1).
    onAction(focusedIndex as ActionRowIndex<Actions>);
  };

  useKey(
    "ArrowLeft",
    () => {
      const nextIndex = getNextIndex(focusedIndex, -1, actionCount, wrap, disabledKey);
      if (nextIndex !== null && nextIndex !== focusedIndex) {
        focusAction(nextIndex);
        onNavigate?.(nextIndex as ActionRowIndex<Actions>);
      } else if (nextIndex === focusedIndex) {
        onNavigationBoundaryReached?.("previous");
      }
    },
    keyOptions,
  );

  useKey(
    "ArrowRight",
    () => {
      const nextIndex = getNextIndex(focusedIndex, 1, actionCount, wrap, disabledKey);
      if (nextIndex !== null && nextIndex !== focusedIndex) {
        focusAction(nextIndex);
        onNavigate?.(nextIndex as ActionRowIndex<Actions>);
      } else if (nextIndex === focusedIndex) {
        onNavigationBoundaryReached?.("next");
      }
    },
    keyOptions,
  );

  useKey("ArrowDown", () => enterActions(0), enterOptions);
  useKey("ArrowUp", exitActions, keyOptions);
  useKey("Enter", activateFocusedAction, keyOptions);
  useKey(" ", activateFocusedAction, keyOptions);

  const getActionProps = (index: number) => ({
    ref: ((node: HTMLElement | null) => {
      if (node) actionRefs.current.set(index, node);
      else actionRefs.current.delete(index);
    }) as RefCallback<HTMLElement>,
    "data-action-index": index,
    onFocus: () => {
      if (!isIndexEnabled(index, actionCount, disabledKey)) return;
      setZone("actions");
      setFocusedIndex(index);
    },
  });

  return {
    inActions,
    // focusedIndex is bounded to 0..actionCount-1 by the navigation logic, so it
    // is always a valid Actions index when Actions is a tuple.
    focusedIndex: focusedIndex as ActionRowIndex<Actions>,
    isFocusedActionDisabled: !isIndexEnabled(focusedIndex, actionCount, disabledKey),
    enterActions,
    exitActions,
    reset,
    getActionProps,
  };
}
