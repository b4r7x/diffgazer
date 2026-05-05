"use client";

import { useEffect, useEffectEvent } from "react";
import type { Toast } from "./toast-store";
import { dismiss, pause, resume } from "./toast-store";

export function useToastContainer(
  toasts: Toast[],
  dismissingIds: Set<string>,
) {
  const handleEscape = useEffectEvent(() => {
    const last = toasts.findLast((t) => !dismissingIds.has(t.id));
    if (last) dismiss(last.id);
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") handleEscape();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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
