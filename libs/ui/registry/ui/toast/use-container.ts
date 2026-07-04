"use client";

import { type RefObject, useEffect } from "react";
import { useEscapeKey } from "@/hooks/use-outside-click";
import type { Toast } from "./toast-store";
import { dismiss, pause, resume } from "./toast-store";

function isHovered(node: HTMLElement): boolean {
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
    const last = toasts.findLast((t) => !dismissingIds.has(t.id));
    if (!last) return;
    // Mark the keypress handled so @diffgazer/keys' window-level dispatch
    // (skip-on-defaultPrevented) does not also run a scope's Escape binding —
    // dismissing a toast must not double-fire navigate/cancel actions, and the
    // region now sits above any open dialog so it must not also close the dialog.
    event.preventDefault();
    dismiss(last.id);
  };

  useEscapeKey(handleEscape, enabled && toasts.length > 0, { priority: 0, ref: containerRef });

  useEffect(() => {
    if (!enabled) return;
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
  }, [containerRef, enabled]);
}
