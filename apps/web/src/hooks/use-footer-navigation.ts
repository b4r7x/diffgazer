import { useState, type RefObject } from "react";
import { useKey } from "keyscope";

interface UseFooterNavigationOptions {
  enabled: boolean;
  buttonCount: number;
  onAction: (index: number) => void;
  targetRef?: RefObject<HTMLElement | null>;
  allowInInput?: boolean;
  wrap?: boolean;
}

export function useFooterNavigation({
  enabled,
  buttonCount,
  onAction,
  targetRef,
  allowInInput = false,
  wrap = false,
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
    setFocusedIndex(0);
  };

  const keyOptions = {
    enabled: enabled && inFooter,
    targetRef,
    requireFocusWithin: Boolean(targetRef),
    allowInInput,
  } as const;

  const enterOptions = {
    enabled: enabled && !inFooter,
    targetRef,
    requireFocusWithin: Boolean(targetRef),
    allowInInput,
  } as const;

  // ArrowDown enters footer actions when focus is outside the footer.
  useKey("ArrowDown", () => enterFooter(0), enterOptions);

  // ArrowUp returns to options
  useKey("ArrowUp", exitFooter, keyOptions);

  // ArrowLeft to navigate between buttons
  useKey(
    "ArrowLeft",
    () => {
      setFocusedIndex((prev) =>
        wrap ? (prev > 0 ? prev - 1 : buttonCount - 1) : Math.max(0, prev - 1)
      );
    },
    keyOptions
  );

  // ArrowRight to navigate between buttons
  useKey(
    "ArrowRight",
    () => {
      setFocusedIndex((prev) =>
        wrap
          ? prev < buttonCount - 1
            ? prev + 1
            : 0
          : Math.min(buttonCount - 1, prev + 1)
      );
    },
    keyOptions
  );

  // Enter triggers focused button
  useKey(
    "Enter",
    () => onAction(focusedIndex),
    keyOptions
  );

  // Space triggers focused button
  useKey(
    " ",
    () => onAction(focusedIndex),
    keyOptions
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
