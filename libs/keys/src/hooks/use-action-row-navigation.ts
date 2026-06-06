"use client";

import { type RefCallback, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { containsActiveElement } from "../dom/focusable.js";
import { useFocusZone } from "./use-focus-zone.js";
import { useKey } from "./use-key.js";

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

export interface UseActionRowNavigationOptions<
  Actions extends readonly unknown[] = readonly unknown[],
> {
  enabled: boolean;
  actionCount: Actions["length"];
  onAction: (index: ActionRowIndex<Actions>) => void;
  disabledActions?: ActionRowDisabledFlags<Actions>;
  disabledFocusFallbackRef?: RefObject<HTMLElement | null>;
  containerRef?: RefObject<HTMLElement | null>;
  allowInInput?: boolean;
  wrap?: boolean;
  defaultZone?: ActionRowZone;
  defaultIndex?: ActionRowIndex<Actions>;
  canExitActions?: boolean;
  onNavigate?: (index: ActionRowIndex<Actions>) => void;
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

export interface UseActionRowNavigationReturn {
  inActions: boolean;
  focusedIndex: number;
  isFocusedActionDisabled: boolean;
  enterActions: (index?: number) => number | null;
  exitActions: () => void;
  reset: (initialIndex?: number) => void;
  getActionProps: (index: number) => {
    ref: RefCallback<HTMLElement>;
    "data-action-index": number;
    onFocus: () => void;
  };
}

export function useActionRowNavigation<
  Actions extends readonly unknown[] = readonly unknown[],
>({
  enabled,
  actionCount,
  onAction,
  disabledActions = EMPTY_DISABLED as ActionRowDisabledFlags<Actions>,
  disabledFocusFallbackRef,
  containerRef,
  allowInInput = false,
  wrap = false,
  defaultZone = "content",
  defaultIndex = 0 as ActionRowIndex<Actions>,
  canExitActions = true,
  onNavigate,
  onNavigationBoundaryReached,
}: UseActionRowNavigationOptions<Actions>): UseActionRowNavigationReturn {
  const [focusedIndex, setFocusedIndex] = useState<number>(defaultIndex);
  const actionRefs = useRef(new Map<number, HTMLElement>());
  const hasFocusedDefaultRef = useRef(false);
  const disabledKey = getDisabledKey(actionCount, disabledActions);

  const focusZone = useFocusZone<ActionRowZone>({
    initial: defaultZone,
    zones: ACTION_ROW_ZONES,
    enabled,
    containerRef,
    focusWithinOnly: Boolean(containerRef),
    allowInInput,
  });
  const inActions = focusZone.isZone("actions");
  const setZone = focusZone.setZone;

  const getEnabledTargetIndex = useCallback((index: number) => {
    return isIndexEnabled(index, actionCount, disabledKey)
      ? index
      : getFirstEnabled(actionCount, disabledKey);
  }, [actionCount, disabledKey]);

  const focusAction = useCallback((index: number) => {
    const targetIndex = getEnabledTargetIndex(index);
    if (targetIndex === null) return null;

    setFocusedIndex(targetIndex);
    actionRefs.current.get(targetIndex)?.focus();
    return targetIndex;
  }, [getEnabledTargetIndex]);

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
    focusedIndex,
    isFocusedActionDisabled: !isIndexEnabled(focusedIndex, actionCount, disabledKey),
    enterActions,
    exitActions,
    reset,
    getActionProps,
  };
}
