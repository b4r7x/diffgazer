"use client";

import type { ReactNode } from "react";
import { PopoverRoot } from "../popover/popover";
import { PopoverTrigger } from "../popover/popover-trigger";
import { TooltipContent } from "./tooltip-content";

/** Props for tooltip. */
export interface TooltipProps {
  /** Trigger element (shorthand mode) or full Tooltip.Trigger/Tooltip.Content composition. */
  children: ReactNode;
  /**
   * Shorthand: when set, Tooltip renders children inside Tooltip.Trigger and content inside
   * Tooltip.Content automatically. When omitted, compose Tooltip.Trigger and Tooltip.Content
   * explicitly via children.
   */
  content?: ReactNode;
  /** Disables hover/focus triggering when false (use to suppress tooltips conditionally). */
  enabled?: boolean;
  /** Show delay after pointer/focus enters the trigger. */
  delayMs?: number;
  /** Hide delay after pointer/focus leaves the trigger or content. */
  closeDelayMs?: number;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state for uncontrolled mode. */
  defaultOpen?: boolean;
  /** Fired when the open state changes. */
  onOpenChange?: (open: boolean) => void;
}

/** Root - manages hover state, delay, and enabled toggle. */
export function TooltipRoot({
  children,
  content,
  enabled = true,
  delayMs = 500,
  closeDelayMs,
  open,
  defaultOpen,
  onOpenChange,
}: TooltipProps) {
  return (
    <PopoverRoot
      triggerMode="hover"
      enabled={enabled}
      delayMs={delayMs}
      closeDelayMs={closeDelayMs}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {content != null ? (
        <>
          <PopoverTrigger>{children}</PopoverTrigger>
          <TooltipContent>{content}</TooltipContent>
        </>
      ) : (
        children
      )}
    </PopoverRoot>
  );
}
