"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEscapeKey } from "@/hooks/use-outside-click";
import type { Toast } from "./toast-store";
import { dismiss, pause, resume } from "./toast-store";

export function useToastContainer(
  toasts: Toast[],
  dismissingIds: Set<string>,
) {
  const stateRef = useRef({ toasts, dismissingIds });
  stateRef.current = { toasts, dismissingIds };

  const handleEscape = useCallback(() => {
    if (document.querySelector("dialog[open]")) return;
    const current = stateRef.current;
    const last = current.toasts.findLast((t) => !current.dismissingIds.has(t.id));
    if (last) dismiss(last.id);
  }, []);

  useEscapeKey(handleEscape, toasts.length > 0, { priority: 0 });

  useEffect(() => {
    if (!document.hidden) resume();
    function onVisibilityChange() {
      if (document.hidden) pause();
      else resume();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resume();
    };
  }, []);
}
