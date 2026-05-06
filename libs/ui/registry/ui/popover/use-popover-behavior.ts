"use client";

import { useCallback, useRef, useEffect } from "react";
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

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closePopover = useCallback(() => {
    clearTimers();
    onOpenChange(false);
  }, [clearTimers, onOpenChange]);

  const onTriggerEnter = useCallback(() => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
    if (delayMs <= 0) {
      onOpenChange(true);
      return;
    }
    openTimerRef.current = setTimeout(() => onOpenChange(true), delayMs);
  }, [clearTimers, delayMs, enabled, onOpenChange, triggerMode]);

  const scheduleClose = useCallback(() => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
    if (closeDelayMs > 0) {
      closeTimerRef.current = setTimeout(() => onOpenChange(false), closeDelayMs);
    } else {
      onOpenChange(false);
    }
  }, [clearTimers, closeDelayMs, enabled, onOpenChange, triggerMode]);

  const onTriggerClick = useCallback(() => {
    if (!enabled || triggerMode !== "click") return;
    onOpenChange(prev => !prev);
  }, [enabled, onOpenChange, triggerMode]);

  const onContentEnter = useCallback(() => {
    if (!enabled || triggerMode !== "hover") return;
    clearTimers();
  }, [clearTimers, enabled, triggerMode]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    if (!open || triggerMode !== "hover") return;
    const scrollOpts = { capture: true, passive: true } as const;
    window.addEventListener("scroll", closePopover, scrollOpts);
    window.addEventListener("resize", closePopover);
    return () => {
      window.removeEventListener("scroll", closePopover, scrollOpts);
      window.removeEventListener("resize", closePopover);
    };
  }, [closePopover, open, triggerMode]);

  useEffect(() => {
    if (!enabled) closePopover();
  }, [closePopover, enabled]);

  return {
    onTriggerEnter,
    onTriggerLeave: scheduleClose,
    onTriggerClick,
    onContentEnter,
    onContentLeave: scheduleClose,
  };
}
