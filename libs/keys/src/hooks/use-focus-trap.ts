"use client";

import { useEffect, useRef, type RefObject } from "react";
import { getFocusableElements, getTabbableElements, isFocusable } from "../utils/focusable.js";
import { useFocusRestore } from "./use-focus-restore.js";

export interface UseFocusTrapOptions {
  initialFocus?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  enabled?: boolean;
}

function pickInitialTarget(
  container: HTMLElement,
  initialFocus: RefObject<HTMLElement | null> | undefined,
): HTMLElement {
  const requested = initialFocus?.current;
  if (requested && container.contains(requested) && isFocusable(requested)) return requested;
  return getFocusableElements(container)[0] ?? container;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus, restoreFocus = true, enabled = true } = options;
  const activeTrapRef = useRef<{ container: HTMLElement; restoreFocus: boolean; release: () => void } | null>(null);
  const { capture, restore } = useFocusRestore({
    enabled: restoreFocus,
    restoreOnUnmount: restoreFocus,
  });

  useEffect(() => {
    const nextContainer = enabled ? containerRef.current : null;
    if (
      activeTrapRef.current?.container === nextContainer &&
      activeTrapRef.current.restoreFocus === restoreFocus
    ) {
      return;
    }

    activeTrapRef.current?.release();
    activeTrapRef.current = null;

    if (!nextContainer) return;
    const container = nextContainer;
    capture(container.ownerDocument);

    pickInitialTarget(container, initialFocus).focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableEls = getTabbableElements(container);
      if (focusableEls.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      const activeElement = container.ownerDocument.activeElement;
      const View = container.ownerDocument.defaultView;
      const activeIsInside =
        View !== null &&
        activeElement instanceof View.Node &&
        container.contains(activeElement);
      if (activeIsInside && !focusableEls.includes(activeElement as HTMLElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
        return;
      }

      if (e.shiftKey) {
        if (activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    activeTrapRef.current = {
      container,
      restoreFocus,
      release: () => {
        container.removeEventListener("keydown", handleKeyDown);
        if (restoreFocus) restore();
      },
    };
  });

  useEffect(() => {
    return () => {
      const activeTrap = activeTrapRef.current;
      if (!activeTrap) return;
      activeTrapRef.current = null;
      activeTrap.release();
    };
  }, []);
}
