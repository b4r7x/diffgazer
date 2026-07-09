"use client";

import { type RefObject, useEffect, useRef } from "react";
import { getOwnerView, isHTMLElement, isNode } from "../dom/element-guards.js";
import { restoreFocus as restoreFocusTarget } from "../dom/focus-restore.js";
import {
  documentOrder,
  getFocusableElements,
  getTabbableElements,
  isFocusable,
} from "../dom/focusable.js";
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

// Per-document trap stacks: only the top entry captures focus.
const trapStacks = new WeakMap<Document, TrapEntry[]>();

function getTrapStack(ownerDocument: Document): TrapEntry[] {
  let stack = trapStacks.get(ownerDocument);
  if (!stack) {
    stack = [];
    trapStacks.set(ownerDocument, stack);
  }
  return stack;
}

function armEntry(entry: TrapEntry): void {
  if (!entry.suspended) return;
  entry.ownerDocument.addEventListener("keydown", entry.handleKeyDown, true);
  entry.ownerDocument.addEventListener("focusin", entry.handleFocusIn, true);
  entry.observer.observe(entry.container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "hidden", "tabindex", "aria-hidden", "inert", "style", "class"],
  });
  entry.suspended = false;
}

function suspendEntry(entry: TrapEntry): void {
  if (entry.suspended) return;
  entry.ownerDocument.removeEventListener("keydown", entry.handleKeyDown, true);
  entry.ownerDocument.removeEventListener("focusin", entry.handleFocusIn, true);
  entry.observer.disconnect();
  entry.suspended = true;
}

function resumeEntry(entry: TrapEntry): void {
  armEntry(entry);
  const target =
    entry.container.contains(entry.lastFocused) &&
    entry.lastFocused.isConnected &&
    isFocusable(entry.lastFocused)
      ? entry.lastFocused
      : pickInitialTarget(entry.container, entry.initialFocus);
  target.focus();
}

function shouldInsertBefore(incoming: TrapEntry, existing: TrapEntry): boolean {
  // Splice an incoming ancestor before its existing descendant so the descendant
  // stays on top; otherwise activation order makes the new trap the top.
  return (
    incoming.container !== existing.container && incoming.container.contains(existing.container)
  );
}

function pushTrap(entry: TrapEntry): boolean {
  const stack = getTrapStack(entry.ownerDocument);
  const previousTop = stack.at(-1);
  const insertIndex = stack.findIndex((existing) => shouldInsertBefore(entry, existing));
  if (insertIndex === -1) stack.push(entry);
  else stack.splice(insertIndex, 0, entry);

  const nextTop = stack.at(-1);
  if (previousTop && previousTop !== nextTop) suspendEntry(previousTop);
  return nextTop === entry;
}

function removeTrap(entry: TrapEntry): void {
  const stack = getTrapStack(entry.ownerDocument);
  const index = stack.indexOf(entry);
  if (index < 0) return;
  const wasTop = index === stack.length - 1;
  stack.splice(index, 1);
  if (wasTop) {
    const newTop = stack.at(-1);
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

function isInsideContainer(
  container: HTMLElement,
  target: EventTarget | null,
): target is HTMLElement {
  const View = getOwnerView(container);
  return isNode(target, View) && container.contains(target);
}

function getTabbableFromAnchor(
  tabbableEls: HTMLElement[],
  activeElement: HTMLElement,
  shiftKey: boolean,
): HTMLElement | null {
  const documentOrderEls = [...tabbableEls].sort(documentOrder);
  if (shiftKey) {
    for (let index = documentOrderEls.length - 1; index >= 0; index -= 1) {
      const candidate = documentOrderEls[index];
      if (candidate && documentOrder(candidate, activeElement) < 0) return candidate;
    }
    return documentOrderEls.at(-1) ?? null;
  }

  for (const candidate of documentOrderEls) {
    if (documentOrder(activeElement, candidate) < 0) return candidate;
  }
  return documentOrderEls[0] ?? null;
}

/**
 * Keeps Tab and Shift+Tab focus inside a container while active, with nested
 * trap stacking and optional focus restoration on release.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus, restoreFocus = true, enabled = true } = options;
  const activeTrapRef = useRef<ActiveTrap | null>(null);
  const trapEntryRef = useRef<TrapEntry | null>(null);
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
    // Capture the opener before focus moves inside, so a false-to-true toggle can still restore to it.
    const activeAtActivation = ownerDocument.activeElement;
    const opener =
      isHTMLElement(activeAtActivation) && !isInsideContainer(container, activeAtActivation)
        ? activeAtActivation
        : null;
    const restoreTarget = capture(ownerDocument);

    const hadTabIndex = container.hasAttribute("tabindex");
    const originalTabIndex = container.getAttribute("tabindex");
    if (!hadTabIndex) container.setAttribute("tabindex", "-1");

    let lastFocused: HTMLElement = container;

    const recapture = () => {
      const target =
        container.contains(lastFocused) && lastFocused.isConnected && isFocusable(lastFocused)
          ? lastFocused
          : pickInitialTarget(container, initialFocus);
      target.focus();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (isInsideContainer(container, target)) {
        lastFocused = target;
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
        const anchorTarget = isInsideContainer(container, activeElement)
          ? getTabbableFromAnchor(focusableEls, activeElement, event.shiftKey)
          : null;
        (anchorTarget ?? (event.shiftKey ? last : first))?.focus();
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
      if (lastFocused.isConnected && container.contains(lastFocused) && isFocusable(lastFocused))
        return;
      recapture();
    });

    // Push BEFORE arming/focusing: pushTrap suspends the previous top so its
    // focusin handler does not recapture focus away from this new trap.
    const entry: TrapEntry = {
      container,
      ownerDocument,
      initialFocus,
      lastFocused,
      handleKeyDown,
      handleFocusIn,
      observer,
      suspended: true,
    };
    trapEntryRef.current = entry;
    const isTopTrap = pushTrap(entry);

    if (isTopTrap) {
      armEntry(entry);
      if (!isInsideContainer(container, ownerDocument.activeElement)) {
        pickInitialTarget(container, initialFocus).focus();
      }
      lastFocused = isInsideContainer(container, ownerDocument.activeElement)
        ? ownerDocument.activeElement
        : pickInitialTarget(container, initialFocus);
      entry.lastFocused = lastFocused;
    } else if (isInsideContainer(container, ownerDocument.activeElement)) {
      lastFocused = ownerDocument.activeElement;
      entry.lastFocused = lastFocused;
    }

    const activeTrap: ActiveTrap = {
      container,
      restoreFocus,
      release: () => {
        // Detach own listeners BEFORE removeTrap resumes the outer trap; otherwise
        // our focusin sees the outer trap's refocus as an escape and fights it.
        ownerDocument.removeEventListener("keydown", handleKeyDown, true);
        ownerDocument.removeEventListener("focusin", handleFocusIn, true);
        observer.disconnect();

        removeTrap(entry);
        trapEntryRef.current = null;

        if (!hadTabIndex) {
          container.removeAttribute("tabindex");
        } else if (originalTabIndex !== null) {
          container.setAttribute("tabindex", originalTabIndex);
        }

        if (activeTrap.restoreFocus) {
          const hasOuterTrap = getTrapStack(ownerDocument).length > 0;
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
