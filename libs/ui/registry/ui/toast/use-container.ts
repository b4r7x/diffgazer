"use client";

import { type RefObject, useEffect } from "react";
import { useEscapeKey } from "@/hooks/use-outside-click";
import type { Toast } from "./toast-store";
import { dismiss, pause, resume } from "./toast-store";

export function useToastContainer(
  toasts: Toast[],
  dismissingIds: Set<string>,
  containerRef: RefObject<HTMLElement | null>,
) {
  const handleEscape = () => {
    const ownerDocument = containerRef.current?.ownerDocument;
    if (!ownerDocument) return;
    if (ownerDocument.querySelector("dialog[open]")) return;
    const last = toasts.findLast((t) => !dismissingIds.has(t.id));
    if (last) dismiss(last.id);
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
