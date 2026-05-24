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

interface TrapEntry {
  container: HTMLElement;
  ownerDocument: Document;
  initialFocus: RefObject<HTMLElement | null> | undefined;
  lastFocused: HTMLElement;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleFocusIn: (event: FocusEvent) => void;
  observer: MutationObserver;
  suspended: boolean;
}

interface ActiveTrap {
  container: HTMLElement;
  restoreFocus: boolean;
  release: () => void;
}

// Module-level trap stack: only the top (last) entry captures focus.
// When a new trap activates, the previous top is suspended (listeners removed).
// When the top trap releases, the next-in-stack is re-armed (listeners re-attached).
const trapStack: TrapEntry[] = [];

function suspendEntry(entry: TrapEntry): void {
  if (entry.suspended) return;
  entry.ownerDocument.removeEventListener("keydown", entry.handleKeyDown, true);
  entry.ownerDocument.removeEventListener("focusin", entry.handleFocusIn, true);
  entry.observer.disconnect();
  entry.suspended = true;
}

function resumeEntry(entry: TrapEntry): void {
  if (!entry.suspended) return;
  entry.ownerDocument.addEventListener("keydown", entry.handleKeyDown, true);
  entry.ownerDocument.addEventListener("focusin", entry.handleFocusIn, true);
  entry.observer.observe(entry.container, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "tabindex", "aria-hidden", "inert"] });
  entry.suspended = false;
  // Recapture focus into the resumed trap's container
  const target = entry.container.contains(entry.lastFocused) && entry.lastFocused.isConnected && isFocusable(entry.lastFocused)
    ? entry.lastFocused
    : pickInitialTarget(entry.container, entry.initialFocus);
  target.focus();
}

function pushTrap(entry: TrapEntry): void {
  const prev = trapStack.at(-1);
  if (prev) suspendEntry(prev);
  trapStack.push(entry);
}

function removeTrap(entry: TrapEntry): void {
  const index = trapStack.indexOf(entry);
  if (index < 0) return;
  const wasTop = index === trapStack.length - 1;
  trapStack.splice(index, 1);
  if (wasTop) {
    const newTop = trapStack.at(-1);
    if (newTop) resumeEntry(newTop);
  }
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

// Effect-on-every-render is intentional: React does not re-fire effects when
// containerRef.current mutates while the ref object stays stable.
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus, restoreFocus = true, enabled = true } = options;
  const activeTrapRef = useRef<ActiveTrap | null>(null);
  const trapEntryRef = useRef<TrapEntry | null>(null);
  // useFocusRestore manages the focus-restore stack so nested overlays
  // restore correctly. Restoration itself happens in this hook's release()
  // so listeners are detached BEFORE focus moves out of the container --
  // otherwise the document-level focusin recapture re-traps the restored
  // target. `restoreOnUnmount: false` prevents the stack hook from moving
  // focus during its own unmount cleanup.
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

    // lastFocused is set after initial focus below
    let lastFocused: HTMLElement = container;

    const recapture = () => {
      const target = container.contains(lastFocused) && lastFocused.isConnected && isFocusable(lastFocused)
        ? lastFocused
        : pickInitialTarget(container, initialFocus);
      target.focus();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (isInsideContainer(container, target)) {
        lastFocused = target;
        // Keep the stack entry in sync so resume() can use it
        if (trapEntryRef.current) trapEntryRef.current.lastFocused = target;
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
      if (lastFocused.isConnected && container.contains(lastFocused) && isFocusable(lastFocused)) return;
      recapture();
    });

    // Build the stack entry and push it BEFORE attaching listeners or
    // focusing. pushTrap suspends the previous top trap so its focusin
    // handler does not recapture focus away from this new trap.
    const entry: TrapEntry = {
      container,
      ownerDocument,
      initialFocus,
      lastFocused,
      handleKeyDown,
      handleFocusIn,
      observer,
      suspended: false,
    };
    trapEntryRef.current = entry;
    pushTrap(entry);

    // Attach listeners and focus now that the outer trap is suspended
    ownerDocument.addEventListener("keydown", handleKeyDown, true);
    ownerDocument.addEventListener("focusin", handleFocusIn, true);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "tabindex", "aria-hidden", "inert"] });

    const initialTarget = pickInitialTarget(container, initialFocus);
    initialTarget.focus();
    lastFocused = container.contains(ownerDocument.activeElement)
      ? (ownerDocument.activeElement as HTMLElement)
      : initialTarget;
    entry.lastFocused = lastFocused;

    activeTrapRef.current = {
      container,
      restoreFocus,
      release: () => {
        // Detach own listeners BEFORE removing from the stack. removeTrap
        // calls resumeEntry on the outer trap which focuses into the outer
        // container — if our focusin listener is still attached, it would
        // see that focus escaped and recapture, fighting the outer trap.
        ownerDocument.removeEventListener("keydown", handleKeyDown, true);
        ownerDocument.removeEventListener("focusin", handleFocusIn, true);
        observer.disconnect();

        // Remove from stack. This re-arms the outer trap (if any) which
        // recaptures focus into its container.
        removeTrap(entry);
        trapEntryRef.current = null;

        if (!hadTabIndex) {
          container.removeAttribute("tabindex");
        } else if (originalTabIndex !== null) {
          container.setAttribute("tabindex", originalTabIndex);
        }

        // Only restore focus to pre-trap target if there is no outer trap
        // waiting. When an outer trap exists, resumeEntry() already moved
        // focus back into the outer container.
        if (restoreFocus && trapStack.length === 0) {
          restoreFocusTarget(restoreTarget);
        }
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
