"use client";

import { type RefObject, useEffect } from "react";
import { useEscapeKey } from "@/hooks/use-outside-click";
import type { Toast } from "./toast-store";
import { dismiss, pause, resume } from "./toast-store";

/** Provides toast container behavior. */
export function useToastContainer(
  toasts: Toast[],
  dismissingIds: Set<string>,
  containerRef: RefObject<HTMLElement | null>,
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

  useEscapeKey(handleEscape, toasts.length > 0, { priority: 0, ref: containerRef });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const doc = node.ownerDocument;
    if (!doc.hidden) resume();
    function onVisibilityChange() {
      if (doc.hidden) pause();
      else resume();
    }
    doc.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      doc.removeEventListener("visibilitychange", onVisibilityChange);
      resume();
    };
  }, [containerRef]);
}
