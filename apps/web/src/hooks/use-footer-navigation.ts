import { useCallback, useEffect, useRef, useState, type RefCallback, type RefObject } from "react";
import { containsActiveElement, useFocusZone, useKey } from "@diffgazer/keys";

type FooterNavigationZone = "content" | "footer";
const FOOTER_NAVIGATION_ZONES = ["content", "footer"] as const;

interface UseFooterNavigationOptions {
  enabled: boolean;
  buttonCount: number;
  onAction: (index: number) => void;
  containerRef?: RefObject<HTMLElement | null>;
  allowInInput?: boolean;
  wrap?: boolean;
  defaultZone?: FooterNavigationZone;
  defaultIndex?: number;
  canExitFooter?: boolean;
  onEnterFooter?: (index: number) => void;
  onExitFooter?: () => void;
}

function getNextFooterIndex(
  currentIndex: number,
  direction: -1 | 1,
  buttonCount: number,
  wrap: boolean,
) {
  if (buttonCount <= 0) return 0;

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < buttonCount) return nextIndex;
  if (!wrap) return currentIndex;
  return direction < 0 ? buttonCount - 1 : 0;
}

export function useFooterNavigation({
  enabled,
  buttonCount,
  onAction,
  containerRef,
  allowInInput = false,
  wrap = false,
  defaultZone = "content",
  defaultIndex = 0,
  canExitFooter = true,
  onEnterFooter,
  onExitFooter,
}: UseFooterNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(defaultIndex);
  const buttonRefs = useRef(new Map<number, HTMLElement>());
  const hasFocusedDefaultFooterRef = useRef(false);

  const focusZone = useFocusZone<FooterNavigationZone>({
    initial: defaultZone,
    zones: FOOTER_NAVIGATION_ZONES,
    enabled,
    containerRef,
    focusWithinOnly: Boolean(containerRef),
    allowInInput,
  });
  const inFooter = focusZone.isZone("footer");

  const focusButton = useCallback((index: number) => {
    setFocusedIndex(index);
    buttonRefs.current.get(index)?.focus();
  }, []);

  useEffect(() => {
    if (!enabled || defaultZone !== "footer" || !inFooter || hasFocusedDefaultFooterRef.current) return;
    if (!buttonRefs.current.has(defaultIndex)) return;

    focusButton(defaultIndex);
    hasFocusedDefaultFooterRef.current = true;
  }, [defaultIndex, defaultZone, enabled, focusButton, inFooter]);

  const reset = (initialIndex: number = 0) => {
    focusZone.setZone("content");
    setFocusedIndex(initialIndex);
  };

  const enterFooter = (index: number = 0) => {
    focusZone.setZone("footer");
    focusButton(index);
    onEnterFooter?.(index);
  };

  const exitFooter = () => {
    if (!canExitFooter) return;
    focusZone.setZone("content");
    setFocusedIndex(0);
    onExitFooter?.();
  };

  const keyOptions = focusZone.getKeyOptions("footer");
  const enterOptions = focusZone.getKeyOptions("content");
  const isRegisteredButtonFocused = () => {
    const button = buttonRefs.current.get(focusedIndex);
    return button ? containsActiveElement(button) : false;
  };

  const activateFocusedButton = () => {
    if (isRegisteredButtonFocused()) return;
    onAction(focusedIndex);
  };

  useKey(
    "ArrowLeft",
    () => focusButton(getNextFooterIndex(focusedIndex, -1, buttonCount, wrap)),
    keyOptions,
  );

  useKey(
    "ArrowRight",
    () => focusButton(getNextFooterIndex(focusedIndex, 1, buttonCount, wrap)),
    keyOptions,
  );

  useKey("ArrowDown", () => enterFooter(0), enterOptions);

  useKey("ArrowUp", exitFooter, keyOptions);

  useKey(
    "Enter",
    activateFocusedButton,
    keyOptions
  );

  useKey(
    " ",
    activateFocusedButton,
    keyOptions
  );

  const getButtonProps = (index: number): {
    ref: RefCallback<HTMLButtonElement>;
    "data-footer-action-index": number;
    onFocus: () => void;
    onClick: () => void;
  } => ({
    ref: (node) => {
      if (node) buttonRefs.current.set(index, node);
      else buttonRefs.current.delete(index);
    },
    "data-footer-action-index": index,
    onFocus: () => {
      focusZone.setZone("footer");
      setFocusedIndex(index);
    },
    onClick: () => onAction(index),
  });

  return {
    inFooter,
    focusedIndex,
    enterFooter,
    exitFooter,
    reset,
    getButtonProps,
  };
}
