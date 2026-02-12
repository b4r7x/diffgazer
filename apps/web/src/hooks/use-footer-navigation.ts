import { useState, type RefObject } from "react";
import { useKey } from "keyscope";

interface UseFooterNavigationOptions {
  enabled: boolean;
  buttonCount: number;
  onAction: (index: number) => void;
  targetRef?: RefObject<HTMLElement | null>;
}

export function useFooterNavigation({
  enabled,
  buttonCount,
  onAction,
  targetRef,
}: UseFooterNavigationOptions) {
  const [inFooter, setInFooter] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const reset = (initialIndex: number = 0) => {
    setInFooter(false);
    setFocusedIndex(initialIndex);
  };

  const enterFooter = (index: number = 0) => {
    setInFooter(true);
    setFocusedIndex(index);
  };

  const exitFooter = () => {
    setInFooter(false);
  };

  const keyOptions = {
    enabled: enabled && inFooter,
    targetRef,
    requireFocusWithin: Boolean(targetRef),
  } as const;

  const enterOptions = {
    enabled: enabled && !inFooter,
    targetRef,
    requireFocusWithin: Boolean(targetRef),
  } as const;

  useKey("ArrowDown", () => enterFooter(0), { ...enterOptions, preventDefault: true });

  useKey({
    ArrowUp: exitFooter,
    ArrowLeft: () => setFocusedIndex((prev) => (prev > 0 ? prev - 1 : buttonCount - 1)),
    ArrowRight: () => setFocusedIndex((prev) => (prev < buttonCount - 1 ? prev + 1 : 0)),
    " ": () => onAction(focusedIndex),
  }, { ...keyOptions, preventDefault: true });

  useKey("Enter", () => onAction(focusedIndex), keyOptions);

  return {
    inFooter,
    focusedIndex,
    setFocusedIndex,
    enterFooter,
    exitFooter,
    reset,
  };
}
