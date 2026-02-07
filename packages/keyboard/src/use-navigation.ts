import type { RefObject, KeyboardEvent } from "react";
import { useKey } from "./use-key";
import { useKeys } from "./use-keys";
import { useDomNavigationCore } from "./internal/use-dom-navigation-core";
import type { NavigationRole } from "./types";

interface UseNavigationBaseOptions {
  containerRef: RefObject<HTMLElement | null>;
  role: NavigationRole;
  value?: string | null;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  onEnter?: (value: string) => void;
  onFocusChange?: (value: string) => void;
  wrap?: boolean;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  initialValue?: string | null;
  upKeys?: string[];
  downKeys?: string[];
}

interface UseScopedNavigationOptions extends UseNavigationBaseOptions {
  mode?: "scoped";
  requireFocusWithin?: boolean;
}

interface UseLocalNavigationOptions extends UseNavigationBaseOptions {
  mode: "local";
}

export type UseNavigationOptions =
  | UseScopedNavigationOptions
  | UseLocalNavigationOptions;

export interface UseNavigationReturn {
  focusedValue: string | null;
  isFocused: (value: string) => boolean;
  focus: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}

export function useNavigation(options: UseLocalNavigationOptions): UseNavigationReturn & { onKeyDown: (event: KeyboardEvent) => void };
export function useNavigation(options: UseScopedNavigationOptions): UseNavigationReturn & { onKeyDown?: undefined };
export function useNavigation(options: UseNavigationOptions): UseNavigationReturn;
export function useNavigation({
  containerRef,
  role,
  value,
  onValueChange,
  onSelect,
  onEnter,
  onFocusChange,
  wrap = true,
  enabled = true,
  onBoundaryReached,
  initialValue = null,
  upKeys = ["ArrowUp"],
  downKeys = ["ArrowDown"],
  ...rest
}: UseNavigationOptions): UseNavigationReturn {
  const mode = "mode" in rest ? rest.mode ?? "scoped" : "scoped";
  const isScoped = mode === "scoped";
  const requireFocusWithin = "requireFocusWithin" in rest ? rest.requireFocusWithin : false;

  const { focusedValue, isFocused, focus, move, focusIndex, handleSelect, handleEnter, getElements } =
    useDomNavigationCore({
      containerRef,
      role,
      value,
      onValueChange,
      onSelect,
      onEnter,
      onFocusChange,
      wrap,
      onBoundaryReached,
      initialValue,
    });

  // Scoped mode: register keys via KeyboardProvider
  const scopedEnabled = enabled && isScoped;
  const keyOptions = {
    enabled: scopedEnabled,
    targetRef: containerRef,
    requireFocusWithin,
  } as const;

  useKeys(upKeys, () => move(-1), keyOptions);
  useKeys(downKeys, () => move(1), keyOptions);
  useKey("Home", () => focusIndex(0), keyOptions);
  useKey("End", () => {
    const elements = getElements();
    if (elements.length === 0) return;
    focusIndex(elements.length - 1);
  }, keyOptions);
  useKey("Enter", handleEnter, keyOptions);
  useKey(" ", handleSelect, keyOptions);

  if (!isScoped) {
    // Local mode: return onKeyDown handler
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;

      const key = event.key;

      if (upKeys.includes(key)) {
        event.preventDefault();
        move(-1);
        return;
      }
      if (downKeys.includes(key)) {
        event.preventDefault();
        move(1);
        return;
      }

      switch (key) {
        case "Home":
          event.preventDefault();
          focusIndex(0);
          break;
        case "End": {
          event.preventDefault();
          const elements = getElements();
          if (elements.length > 0) {
            focusIndex(elements.length - 1);
          }
          break;
        }
        case "Enter":
          event.preventDefault();
          handleEnter();
          break;
        case " ":
          event.preventDefault();
          handleSelect();
          break;
      }
    };

    return { focusedValue, isFocused, focus, onKeyDown };
  }

  return { focusedValue, isFocused, focus };
}
