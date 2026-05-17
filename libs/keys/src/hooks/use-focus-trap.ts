"use client";

import { useEffect, useRef, type RefObject } from "react";
import { getOwnerView } from "../dom/dom.js";
import { restoreFocus as restoreFocusTarget } from "../dom/focus-restore.js";
import { getFocusableElements, getTabbableElements, isFocusable } from "../dom/focusable.js";
import { useFocusRestore } from "./use-focus-restore.js";

export interface UseFocusTrapOptions {
  initialFocus?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
  enabled?: boolean;
}

interface ActiveTrap {
  container: HTMLElement;
  restoreFocus: boolean;
  release: () => void;
}

function pickInitialTarget(
  container: HTMLElement,
  initialFocus: RefObject<HTMLElement | null> | undefined,
): HTMLElement {
  const requested = initialFocus?.current;
  if (requested && container.contains(requested) && isFocusable(requested)) return requested;
  return getFocusableElements(container)[0] ?? container;
}

function isInsideContainer(container: HTMLElement, target: EventTarget | null): target is HTMLElement {
  const View = getOwnerView(container);
  if (!View) return false;
  return target instanceof View.Node && container.contains(target as Node);
}

/**
 * Trap Tab focus inside `containerRef` while mounted. Focus is moved into the
 * container on activation and restored to the previously focused element on
 * unmount (when `restoreFocus` is true).
 *
 * @example
 * ```tsx
 * function ConfirmDialog({ onClose }: { onClose: () => void }) {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const confirmRef = useRef<HTMLButtonElement>(null);
 *   useFocusTrap(containerRef, { initialFocus: confirmRef });
 *   useKey("Escape", onClose);
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <p>Discard changes?</p>
 *       <button onClick={onClose}>Cancel</button>
 *       <button ref={confirmRef} onClick={onClose}>Discard</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * Effect-on-every-render is intentional. React does not re-fire effects when
 * `containerRef.current` mutates while the ref object stays stable. Consumers
 * pass a stable RefObject that React assigns the latest DOM node to, and the
 * trap must detach from the previous node and attach to the new one as soon
 * as that happens. The early-return below compares `activeTrapRef.current`
 * against the live `containerRef.current` and short-circuits when nothing
 * changed, so the per-render cost is one ref read plus two equality checks.
 *
 * Listeners attach on `container.ownerDocument` in the capture phase so a
 * descendant calling `event.stopPropagation()` cannot bypass the trap, and so
 * Tab presses fire even when focus has escaped the container. A `focusin`
 * capture listener recaptures escaped focus to the last in-trap element (or
 * the initial target on first activation), and a MutationObserver re-targets
 * focus when the focused element is removed from the container.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus, restoreFocus = true, enabled = true } = options;
  const activeTrapRef = useRef<ActiveTrap | null>(null);
  // useFocusRestore manages the nested-trap stack so outer traps remain
  // dormant while an inner trap is active. Restoration itself happens in this
  // hook's release() so listeners are detached BEFORE focus moves out of the
  // container — otherwise the document-level focusin recapture re-traps the
  // restored target. `restoreOnUnmount: false` prevents the stack hook from
  // moving focus during its own unmount cleanup.
  const { capture } = useFocusRestore({
    enabled: restoreFocus,
    restoreOnUnmount: false,
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
    const ownerDocument = container.ownerDocument;
    const restoreTarget = capture(ownerDocument);

    const hadTabIndex = container.hasAttribute("tabindex");
    const originalTabIndex = container.getAttribute("tabindex");
    if (!hadTabIndex) container.setAttribute("tabindex", "-1");

    const initialTarget = pickInitialTarget(container, initialFocus);
    initialTarget.focus();
    let lastFocused: HTMLElement = container.contains(ownerDocument.activeElement)
      ? (ownerDocument.activeElement as HTMLElement)
      : initialTarget;

    const recapture = () => {
      const target = container.contains(lastFocused) && lastFocused.isConnected
        ? lastFocused
        : pickInitialTarget(container, initialFocus);
      target.focus();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (isInsideContainer(container, target)) {
        lastFocused = target;
        return;
      }
      recapture();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusableEls = getTabbableElements(container);
      if (focusableEls.length === 0) {
        event.preventDefault();
        if (ownerDocument.activeElement !== container) container.focus();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      const activeElement = ownerDocument.activeElement;

      if (!isInsideContainer(container, activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        return;
      }

      if (!focusableEls.includes(activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        return;
      }

      if (event.shiftKey) {
        if (activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else {
        if (activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    const observer = new MutationObserver(() => {
      if (lastFocused.isConnected && container.contains(lastFocused)) return;
      recapture();
    });
    observer.observe(container, { childList: true, subtree: true });

    ownerDocument.addEventListener("keydown", handleKeyDown, true);
    ownerDocument.addEventListener("focusin", handleFocusIn, true);

    activeTrapRef.current = {
      container,
      restoreFocus,
      release: () => {
        ownerDocument.removeEventListener("keydown", handleKeyDown, true);
        ownerDocument.removeEventListener("focusin", handleFocusIn, true);
        observer.disconnect();
        if (!hadTabIndex) {
          container.removeAttribute("tabindex");
        } else if (originalTabIndex !== null) {
          container.setAttribute("tabindex", originalTabIndex);
        }
        if (restoreFocus) restoreFocusTarget(restoreTarget);
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
