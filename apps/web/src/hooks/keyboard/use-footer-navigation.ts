import { useState, useCallback } from "react";
import { useKey } from "./use-key";

interface UseFooterNavigationOptions {
  enabled: boolean;
  buttonCount: number;
  onAction: (index: number) => void;
}

export function useFooterNavigation({
  enabled,
  buttonCount,
  onAction,
}: UseFooterNavigationOptions) {
  const [inFooter, setInFooter] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const reset = useCallback((initialIndex: number = 0) => {
    setInFooter(false);
    setFocusedIndex(initialIndex);
  }, []);

  const enterFooter = useCallback((index: number = 0) => {
    setInFooter(true);
    setFocusedIndex(index);
  }, []);

  const exitFooter = useCallback(() => {
    setInFooter(false);
  }, []);

  // ArrowUp returns to options
  useKey("ArrowUp", exitFooter, { enabled: enabled && inFooter });

  // ArrowLeft to navigate between buttons
  useKey(
    "ArrowLeft",
    () => {
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : buttonCount - 1));
    },
    { enabled: enabled && inFooter }
  );

  // ArrowRight to navigate between buttons
  useKey(
    "ArrowRight",
    () => {
      setFocusedIndex((prev) => (prev < buttonCount - 1 ? prev + 1 : 0));
    },
    { enabled: enabled && inFooter }
  );

  // Enter triggers focused button
  useKey(
    "Enter",
    () => onAction(focusedIndex),
    { enabled: enabled && inFooter }
  );

  // Space triggers focused button
  useKey(
    " ",
    () => onAction(focusedIndex),
    { enabled: enabled && inFooter }
  );

  return {
    inFooter,
    focusedIndex,
    setFocusedIndex,
    enterFooter,
    exitFooter,
    reset,
  };
}
