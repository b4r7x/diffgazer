"use client";

import { type RefObject, useEffect, useRef } from "react";
import {
  composedContains,
  getDeepActiveElement,
  isHTMLElement,
} from "../dom/element-guards.js";
import { restoreFocus as restoreFocusTarget } from "../dom/focus-restore.js";
import { getFocusableElements, isFocusable } from "../dom/focusable.js";
import { createFocusTrapController } from "./focus-trap-controller.js";
import { useFocusRestore } from "./use-focus-restore.js";

/** Options for trapping Tab focus inside a container. */
export interface UseFocusTrapOptions {
  /** Element that receives focus when the trap activates. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Restore focus to the previously focused element when the trap releases. */
  restoreFocus?: boolean;
  /** Whether the focus trap is active. */
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
  if (requested && composedContains(container, requested) && isFocusable(requested))
    return requested;
  return getFocusableElements(container)[0] ?? container;
}

function isInsideContainer(
  container: HTMLElement,
  target: EventTarget | null,
): target is HTMLElement {
  return isHTMLElement(target) && composedContains(container, target);
}

/**
 * Keeps Tab and Shift+Tab focus inside a container while active, with nested
 * trap stacking and optional focus restoration on release. Active traps listen
 * for keydown and focusin in the capture phase on the container's owner document.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus, restoreFocus = true, enabled = true } = options;
  const activeTrapRef = useRef<ActiveTrap | null>(null);
  // Detach listeners BEFORE focus moves out in release(), or the document-level
  // focusin recapture re-traps the restored target. restoreOnUnmount:false keeps
  // this stack hook from moving focus during its own unmount cleanup.
  const { capture, restore } = useFocusRestore({
    enabled: restoreFocus,
    restoreOnUnmount: false,
  });

  // No dependency array on purpose: React does not re-fire effects when
  // containerRef.current mutates while the ref object stays stable.
  useEffect(() => {
    const nextContainer = enabled ? containerRef.current : null;
    const active = activeTrapRef.current;
    if (active && active.container === nextContainer) {
      // restoreFocus is release-time policy; update in place instead of tearing
      // down (which would recapture the interior as the restore target, not the opener).
      active.restoreFocus = restoreFocus;
      return;
    }

    active?.release();
    activeTrapRef.current = null;

    if (!nextContainer) return;
    const container = nextContainer;
    const ownerDocument = container.ownerDocument;
    // Resolve the observer BEFORE any side effect (focus capture, tabindex mutation)
    // so a document without MutationObserver bails out leaving the container untouched.
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (typeof MutationObserverCtor !== "function") return;
    // Capture the opener before focus moves inside, so a false-to-true toggle can still restore to it.
    const activeAtActivation = getDeepActiveElement(ownerDocument);
    const opener =
      isHTMLElement(activeAtActivation) && !isInsideContainer(container, activeAtActivation)
        ? activeAtActivation
        : null;
    const restoreTarget = capture(ownerDocument);

    const controller = createFocusTrapController({
      container,
      resolveInitialFocus: () => pickInitialTarget(container, initialFocus),
      MutationObserverCtor,
    });
    // Push BEFORE arming/focusing: pushTrap suspends the previous top so its
    // focusin handler does not recapture focus away from this new trap.
    controller.activate();

    const activeTrap: ActiveTrap = {
      container,
      restoreFocus,
      release: () => {
        const { hasOuterTrap } = controller.release();

        if (activeTrap.restoreFocus) {
          const restored = restore();
          if (!restored && !hasOuterTrap) restoreFocusTarget(restoreTarget ?? opener);
        }
      },
    };
    activeTrapRef.current = activeTrap;
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
