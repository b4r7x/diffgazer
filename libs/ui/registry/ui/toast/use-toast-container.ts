"use client";

import { useEffect } from "react";
import { useEscapeKey } from "@/hooks/use-outside-click";
import type { Toast } from "./toast-store";
import { dismiss, pause, resume } from "./toast-store";

export function useToastContainer(
  toasts: Toast[],
  dismissingIds: Set<string>,
) {
  const handleEscape = () => {
    if (document.querySelector("dialog[open]")) return;
    const last = toasts.findLast((t) => !dismissingIds.has(t.id));
    if (last) dismiss(last.id);
  };

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
