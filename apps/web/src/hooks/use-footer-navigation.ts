import { useCallback, useEffect, useRef, useState, type RefCallback, type RefObject } from "react";
import { containsActiveElement, useFocusZone, useKey } from "@diffgazer/keys";

type FooterNavigationZone = "content" | "footer";
const FOOTER_NAVIGATION_ZONES = ["content", "footer"] as const;
const EMPTY_DISABLED_ACTIONS: readonly boolean[] = [];

interface UseFooterNavigationOptions {
  enabled: boolean;
  buttonCount: number;
  onAction: (index: number) => void;
  disabledActions?: readonly boolean[];
  disabledFocusFallbackRef?: RefObject<HTMLElement | null>;
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
  disabledActionsKey: string,
) {
  if (buttonCount <= 0) return null;

  let nextIndex = currentIndex + direction;
  for (let attempts = 0; attempts < buttonCount; attempts += 1) {
    if (nextIndex < 0 || nextIndex >= buttonCount) {
      if (!wrap) return isFooterIndexEnabled(currentIndex, buttonCount, disabledActionsKey) ? currentIndex : null;
      nextIndex = direction < 0 ? buttonCount - 1 : 0;
    }

    if (isFooterIndexEnabled(nextIndex, buttonCount, disabledActionsKey)) return nextIndex;
    nextIndex += direction;
  }

  return isFooterIndexEnabled(currentIndex, buttonCount, disabledActionsKey) ? currentIndex : null;
}

function isFooterIndexEnabled(
  index: number,
  buttonCount: number,
  disabledActionsKey: string,
) {
  return index >= 0 && index < buttonCount && disabledActionsKey[index] !== "1";
}

function getFirstEnabledFooterIndex(
  buttonCount: number,
  disabledActionsKey: string,
) {
  for (let index = 0; index < buttonCount; index += 1) {
    if (isFooterIndexEnabled(index, buttonCount, disabledActionsKey)) return index;
  }
  return null;
}

function getDisabledActionsKey(buttonCount: number, disabledActions: readonly boolean[]): string {
  let key = "";
  for (let index = 0; index < buttonCount; index += 1) {
    key += disabledActions[index] ? "1" : "0";
  }
  return key;
}

export function useFooterNavigation({
  enabled,
  buttonCount,
  onAction,
  disabledActions = EMPTY_DISABLED_ACTIONS,
  disabledFocusFallbackRef,
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
  const disabledActionsKey = getDisabledActionsKey(buttonCount, disabledActions);

  const focusZone = useFocusZone<FooterNavigationZone>({
    initial: defaultZone,
    zones: FOOTER_NAVIGATION_ZONES,
    enabled,
    containerRef,
    focusWithinOnly: Boolean(containerRef),
    allowInInput,
  });
  const inFooter = focusZone.isZone("footer");
  const setZone = focusZone.setZone;

  const getEnabledTargetIndex = useCallback((index: number) => {
    return isFooterIndexEnabled(index, buttonCount, disabledActionsKey)
      ? index
      : getFirstEnabledFooterIndex(buttonCount, disabledActionsKey);
  }, [buttonCount, disabledActionsKey]);

  const focusButton = useCallback((index: number) => {
    const targetIndex = getEnabledTargetIndex(index);
    if (targetIndex === null) {
      return null;
    }

    setFocusedIndex(targetIndex);
    buttonRefs.current.get(targetIndex)?.focus();
    return targetIndex;
  }, [getEnabledTargetIndex]);

  const focusDisabledFallback = useCallback(() => {
    const fallback = disabledFocusFallbackRef?.current;
    if (fallback) {
      fallback.focus({ preventScroll: true });
      return;
    }

    const focusedButton = buttonRefs.current.get(focusedIndex);
    if (focusedButton && containsActiveElement(focusedButton)) focusedButton.blur();
  }, [disabledFocusFallbackRef, focusedIndex]);

  const isRegisteredButtonFocused = useCallback(() => {
    const button = buttonRefs.current.get(focusedIndex);
    return button ? containsActiveElement(button) : false;
  }, [focusedIndex]);

  useEffect(() => {
    if (!enabled || defaultZone !== "footer" || !inFooter || hasFocusedDefaultFooterRef.current) return;
    const targetIndex = getEnabledTargetIndex(defaultIndex);
    if (targetIndex === null) {
      setZone("content");
      focusDisabledFallback();
      hasFocusedDefaultFooterRef.current = true;
      return;
    }
    if (!buttonRefs.current.has(targetIndex)) return;

    focusButton(targetIndex);
    hasFocusedDefaultFooterRef.current = true;
  }, [
    defaultIndex,
    defaultZone,
    enabled,
    focusButton,
    focusDisabledFallback,
    getEnabledTargetIndex,
    inFooter,
    setZone,
  ]);

  useEffect(() => {
    if (!enabled || !inFooter) return;
    if (isFooterIndexEnabled(focusedIndex, buttonCount, disabledActionsKey)) {
      if (!isRegisteredButtonFocused()) focusButton(focusedIndex);
      return;
    }
    const targetIndex = getFirstEnabledFooterIndex(buttonCount, disabledActionsKey);
    if (targetIndex === null) {
      setZone("content");
      focusDisabledFallback();
      return;
    }
    focusButton(targetIndex);
  }, [
    buttonCount,
    disabledActionsKey,
    enabled,
    focusButton,
    focusDisabledFallback,
    focusedIndex,
    inFooter,
    isRegisteredButtonFocused,
    setZone,
  ]);

  const reset = (initialIndex: number = 0) => {
    setZone("content");
    setFocusedIndex(initialIndex);
  };

  const enterFooter = (index: number = 0) => {
    const targetIndex = getEnabledTargetIndex(index);
    if (targetIndex === null) {
      setZone("content");
      focusDisabledFallback();
      return null;
    }

    setZone("footer");
    focusButton(targetIndex);
    onEnterFooter?.(targetIndex);
    return targetIndex;
  };

  const exitFooter = () => {
    if (!canExitFooter) return;
    setZone("content");
    setFocusedIndex(0);
    onExitFooter?.();
  };

  const keyOptions = focusZone.getKeyOptions("footer");
  const enterOptions = focusZone.getKeyOptions("content");

  const activateFocusedButton = (event: KeyboardEvent) => {
    if (!isFooterIndexEnabled(focusedIndex, buttonCount, disabledActionsKey)) return;
    if (isRegisteredButtonFocused()) return;
    event.preventDefault();
    onAction(focusedIndex);
  };

  useKey(
    "ArrowLeft",
    () => {
      const nextIndex = getNextFooterIndex(focusedIndex, -1, buttonCount, wrap, disabledActionsKey);
      if (nextIndex !== null) focusButton(nextIndex);
    },
    keyOptions,
  );

  useKey(
    "ArrowRight",
    () => {
      const nextIndex = getNextFooterIndex(focusedIndex, 1, buttonCount, wrap, disabledActionsKey);
      if (nextIndex !== null) focusButton(nextIndex);
    },
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
  } => ({
    ref: (node) => {
      if (node) buttonRefs.current.set(index, node);
      else buttonRefs.current.delete(index);
    },
    "data-footer-action-index": index,
    onFocus: () => {
      if (!isFooterIndexEnabled(index, buttonCount, disabledActionsKey)) return;
      setZone("footer");
      setFocusedIndex(index);
    },
  });

  return {
    inFooter,
    focusedIndex,
    isFocusedActionDisabled: !isFooterIndexEnabled(focusedIndex, buttonCount, disabledActionsKey),
    enterFooter,
    exitFooter,
    reset,
    getButtonProps,
  };
}
