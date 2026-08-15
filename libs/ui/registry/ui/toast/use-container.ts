"use client";

import { type RefObject, useEffect } from "react";
import { useEscapeKey } from "@/hooks/use-outside-click";
import type { Toast } from "./toast-store";
import { dismiss, pause, resume } from "./toast-store";

function isHovered(node: HTMLElement): boolean {
  // jsdom's selector engine rejects the :hover dynamic pseudo-class; treat that
  // as "not hovered".
  try {
    return node.matches(":hover");
  } catch {
    return false;
  }
}

/** Provides toast container behavior. */
export function useToastContainer(
  toasts: Toast[],
  dismissingIds: Set<string>,
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const handleEscape = (event: KeyboardEvent) => {
    const hasVisible = toasts.some((t) => !dismissingIds.has(t.id));
    if (!hasVisible) return;
    // Mark the keypress handled so @diffgazer/keys' window-level dispatch
    // (skip-on-defaultPrevented) does not also run a scope's Escape binding —
    // dismissing toasts must not double-fire navigate/cancel actions, and the
    // region now sits above any open dialog so it must not also close the dialog.
    event.preventDefault();
    // One Escape clears the entire visible stack. Dismissing one toast per
    // press would leave the screen's advertised Esc action dead for N presses
    // after an error burst; this keeps it at most one extra press away.
    dismiss();
  };

  const toastCount = toasts.length;
  const hasToasts = toastCount > 0;
  useEscapeKey(handleEscape, enabled && hasToasts, { priority: 0, ref: containerRef });

  // Re-derive the pause causes whenever the visible stack changes. Removing a
  // focused toast drops activeElement to body without a blur event, so a
  // stale "focus" pause must be cleared even when siblings remain visible.
  useEffect(() => {
    if (!enabled || toastCount === 0) return;
    const node = containerRef.current;
    if (!node) return;
    const doc = node.ownerDocument;
    if (node.contains(doc.activeElement)) pause("focus");
    else resume("focus");
    if (isHovered(node)) pause("hover");
    else resume("hover");
    if (doc.hidden) pause("document-hidden");
    else resume("document-hidden");
    function onVisibilityChange() {
      if (doc.hidden) pause("document-hidden");
      else resume("document-hidden");
    }
    doc.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      doc.removeEventListener("visibilitychange", onVisibilityChange);
      resume("document-hidden");
      resume("focus");
      resume("hover");
    };
  }, [containerRef, enabled, toastCount]);
}
