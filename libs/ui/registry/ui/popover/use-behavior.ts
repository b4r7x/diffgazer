"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { PopoverTriggerMode } from "./popover-context";

export interface UsePopoverBehaviorOptions {
  /** Controlled open state. Pair with onOpenChange. */
  open: boolean;
  /** Fired when the open state changes. */
  onOpenChange: (next: boolean | ((prev: boolean) => boolean)) => void;
  /** When false, the popover never opens and trigger handlers are no-ops. */
  enabled?: boolean;
  /** Click toggles; hover opens on pointer/focus enter with a delay and closes on leave. */
  triggerMode?: PopoverTriggerMode;
  /** Hover mode only. Delay before opening on hover or focus. */
  delayMs?: number;
  /** Delay before closing after hover/focus leaves the trigger or content. */
  closeDelayMs?: number;
  /** Ref for the trigger element. */
  triggerRef?: RefObject<HTMLElement | null>;
}

export interface UsePopoverBehaviorReturn {
  /** Called when trigger enter occurs. */
  onTriggerEnter: () => void;
  /** Called when trigger focus occurs. */
  onTriggerFocus: () => void;
  /** Called when trigger leave occurs. */
  onTriggerLeave: () => void;
  /** Called when trigger click occurs. */
  onTriggerClick: () => void;
  /** Called when trigger pointer down occurs. */
  onTriggerPointerDown: () => void;
  /** Suppresses immediate focus-open after dismissal. */
  markDismissed: () => void;
  /** Called when content enter occurs. */
  onContentEnter: () => void;
  /** Called when content leave occurs. */
  onContentLeave: () => void;
}

// Window after a pointer interaction or a dismissal during which keyboard-focus
// must NOT auto-open: a pointer focus is owned by the click/touch toggle, and an
// Escape/outside dismissal refocuses the trigger without intending to reopen.
const FOCUS_OPEN_SUPPRESS_MS = 250;

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
  const suppressFocusOpenUntilRef = useRef(0);

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

  // Keyboard focus opens immediately (no hover-intent delay) so a tabbing user
  // does not wait delayMs per stop; pointer enter keeps the delay above. A focus
  // that immediately follows a pointer interaction or a dismissal is suppressed
  // so it does not fight the click toggle or reopen after Escape/outside close.
  const onTriggerFocus = () => {
    if (!enabled || triggerMode !== "hover") return;
    if (Date.now() < suppressFocusOpenUntilRef.current) return;
    clearTimers();
    onOpenChange(true);
  };

  const onTriggerPointerDown = () => {
    suppressFocusOpenUntilRef.current = Date.now() + FOCUS_OPEN_SUPPRESS_MS;
  };

  const markDismissed = () => {
    suppressFocusOpenUntilRef.current = Date.now() + FOCUS_OPEN_SUPPRESS_MS;
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
    onOpenChange((prev) => !prev);
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
    const view = triggerRef?.current?.ownerDocument?.defaultView ?? window;
    view.addEventListener("scroll", close, scrollOpts);
    view.addEventListener("resize", close);
    return () => {
      view.removeEventListener("scroll", close, scrollOpts);
      view.removeEventListener("resize", close);
    };
  }, [onOpenChange, open, triggerMode, triggerRef]);

  // Close on disable, but bail when already closed so a controlled-open disabled
  // popover does not re-fire the consumer's onOpenChange(false) on every render
  // (onOpenChange has per-render identity for controlled consumers).
  useEffect(() => {
    if (enabled || !open) return;
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    onOpenChange(false);
  }, [enabled, open, onOpenChange]);

  return {
    onTriggerEnter,
    onTriggerFocus,
    onTriggerLeave: scheduleClose,
    onTriggerClick,
    onTriggerPointerDown,
    markDismissed,
    onContentEnter,
    onContentLeave: scheduleClose,
  };
}
