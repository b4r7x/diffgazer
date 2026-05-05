"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    if (!enabled) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    if (initialFocus?.current) {
      initialFocus.current.focus();
    } else {
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables[0]) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableEls = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableEls.length === 0) return;

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
      if (restoreFocus) {
        previousFocus?.focus();
      }
    };
  // Note: containerRef and initialFocus are RefObjects (stable identity).
  // If a new ref object is passed, the effect will not re-run.
  }, [enabled, restoreFocus]);
}