"use client";

import { useEffect, useRef, type RefObject } from "react";
import { getOwnerView } from "../dom/dom.js";
import { getFocusableElements, getTabbableElements, isFocusable } from "../dom/focusable.js";
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

/**
 * Trap Tab focus inside `containerRef`.
 *
 * Effect-on-every-render is intentional. React does not re-fire effects when
 * `containerRef.current` mutates while the ref object stays stable. Consumers
 * pass a stable RefObject that React assigns the latest DOM node to, and the
 * trap must detach from the previous node and attach to the new one as soon
 * as that happens. The early-return below compares `activeTrapRef.current`
 * against the live `containerRef.current` and short-circuits when nothing
 * changed, so the per-render cost is one ref read plus two equality checks.
 */
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

  // No dependency array on purpose; see hook-level comment above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const View = getOwnerView(container);
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
