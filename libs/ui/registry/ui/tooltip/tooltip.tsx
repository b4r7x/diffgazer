"use client";

import type { ReactNode } from "react";
import { PopoverRoot } from "../popover/popover";
import { PopoverTrigger } from "../popover/popover-trigger";
import { TooltipContent } from "./tooltip-content";

export interface TooltipProps {
  /** Trigger element (shorthand mode) or full Tooltip.Trigger/Tooltip.Content composition. */
  children: ReactNode;
  /**
   * Shorthand: when set to renderable content, Tooltip renders children inside Tooltip.Trigger
   * and content inside Tooltip.Content automatically. When omitted — or falsy, as in the
   * conditional `content={isTruncated && label}` idiom — compose Tooltip.Trigger and
   * Tooltip.Content explicitly via children.
   */
  content?: ReactNode;
  /** Disables hover/focus triggering when false (use to suppress tooltips conditionally). */
  enabled?: boolean;
  /** Show delay after pointer enters the trigger; keyboard focus opens immediately. */
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

/**
 * Shorthand mode needs content that actually renders something. `content={cond && label}`
 * is the common conditional idiom, and taking the shorthand branch for it would open an empty
 * `role="tooltip"` box that the trigger still points at through aria-describedby. `0` is
 * renderable and stays shorthand.
 */
function isRenderableContent(content: ReactNode): boolean {
  return content != null && content !== false && content !== true && content !== "";
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
      {isRenderableContent(content) ? (
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
