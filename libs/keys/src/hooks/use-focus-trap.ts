"use client";

import { useEffect, type RefObject } from "react";
import { getFocusableElements } from "../utils/navigation-items.js";
import { useFocusRestore } from "./use-focus-restore.js";

export interface UseFocusTrapOptions {
  initialFocus?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  enabled?: boolean;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus, restoreFocus = true, enabled = true } = options;
  const { capture, restore } = useFocusRestore({
    enabled: restoreFocus,
    restoreOnUnmount: restoreFocus,
  });

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;
    capture();

    if (initialFocus?.current) {
      initialFocus.current.focus();
    } else {
      const focusables = getFocusableElements(container);
      if (focusables[0]) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableEls = getFocusableElements(container);
      if (focusableEls.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (restoreFocus) restore();
    };
  }, [capture, containerRef, enabled, initialFocus, restore, restoreFocus]);
}
