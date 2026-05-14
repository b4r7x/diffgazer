"use client";

import { useRef, useEffect } from "react";
import type { PopoverTriggerMode } from "./popover-context";

export interface UsePopoverBehaviorOptions {
  open: boolean;
  onOpenChange: (next: boolean | ((prev: boolean) => boolean)) => void;
  enabled?: boolean;
  triggerMode?: PopoverTriggerMode;
  delayMs?: number;
  closeDelayMs?: number;
}

export interface UsePopoverBehaviorReturn {
  onTriggerEnter: () => void;
  onTriggerLeave: () => void;
  onTriggerClick: () => void;
  onContentEnter: () => void;
  onContentLeave: () => void;
}

export function usePopoverBehavior({
  open,
  onOpenChange,
  enabled = true,
  triggerMode = "click",
  delayMs = 500,
  closeDelayMs = 0,
}: UsePopoverBehaviorOptions): UsePopoverBehaviorReturn {
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const onTriggerEnter = () => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
    if (delayMs <= 0) {
      onOpenChange(true);
      return;
    }
    openTimerRef.current = setTimeout(() => onOpenChange(true), delayMs);
  };

  const scheduleClose = () => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
    if (closeDelayMs > 0) {
      closeTimerRef.current = setTimeout(() => onOpenChange(false), closeDelayMs);
    } else {
      onOpenChange(false);
    }
  };

  const onTriggerClick = () => {
    if (!enabled || triggerMode !== "click") return;
    onOpenChange(prev => !prev);
  };

  const onContentEnter = () => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
  };

  // Unmount-only cleanup. Inline timer-clear avoids depending on a function identity.
  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // DOM listener attach/detach: keep deps minimal so listeners only re-attach on real
  // state changes, not on every render.
  useEffect(() => {
    if (!open || triggerMode !== "hover") return;
    const close = () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      onOpenChange(false);
    };
    const scrollOpts = { capture: true, passive: true } as const;
    window.addEventListener("scroll", close, scrollOpts);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, scrollOpts);
      window.removeEventListener("resize", close);
    };
  }, [onOpenChange, open, triggerMode]);

  useEffect(() => {
    if (enabled) return;
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    onOpenChange(false);
  }, [enabled, onOpenChange]);

  return {
    onTriggerEnter,
    onTriggerLeave: scheduleClose,
    onTriggerClick,
    onContentEnter,
    onContentLeave: scheduleClose,
  };
}
