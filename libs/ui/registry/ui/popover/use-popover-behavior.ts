"use client";

import { useRef, useEffect, useEffectEvent, type RefObject } from "react";
import type { PopoverTriggerMode } from "./popover-context";

export interface UsePopoverBehaviorOptions {
  open: boolean;
  onOpenChange: (next: boolean | ((prev: boolean) => boolean)) => void;
  enabled?: boolean;
  triggerMode?: PopoverTriggerMode;
  delayMs?: number;
  closeDelayMs?: number;
  triggerRef: RefObject<HTMLElement | null>;
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
  triggerRef,
}: UsePopoverBehaviorOptions): UsePopoverBehaviorReturn {
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  const closePopover = useEffectEvent(() => {
    clearTimers();
    onOpenChange(false);
  });

  const onTriggerEnter = useEffectEvent(() => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
    openTimerRef.current = setTimeout(() => onOpenChange(true), delayMs);
  });

  const scheduleClose = useEffectEvent(() => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
    if (closeDelayMs > 0) {
      closeTimerRef.current = setTimeout(() => onOpenChange(false), closeDelayMs);
    } else {
      onOpenChange(false);
    }
  });

  const onTriggerClick = useEffectEvent(() => {
    if (!enabled || triggerMode !== "click") return;
    onOpenChange(prev => !prev);
  });

  const onContentEnter = useEffectEvent(() => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
  });

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      clearTimers();
      onOpenChange(false);
      triggerRef.current?.focus();
    }
  });

  useEffect(() => {
    return () => clearTimers();
  }, [triggerMode]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || triggerMode !== "hover") return;
    const scrollOpts = { capture: true, passive: true } as const;
    window.addEventListener("scroll", closePopover, scrollOpts);
    window.addEventListener("resize", closePopover);
    return () => {
      window.removeEventListener("scroll", closePopover, scrollOpts);
      window.removeEventListener("resize", closePopover);
    };
  }, [open, triggerMode]);

  useEffect(() => {
    if (!enabled) closePopover();
  }, [enabled]);

  return {
    onTriggerEnter,
    onTriggerLeave: scheduleClose,
    onTriggerClick,
    onContentEnter,
    onContentLeave: scheduleClose,
  };
}
