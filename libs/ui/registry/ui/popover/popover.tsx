"use client";

import { Children, isValidElement, type ReactNode, useId, useRef } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { PopoverContent } from "./popover-content";
import {
  PopoverContext,
  type PopoverContextValue,
  type PopoverPopupRole,
  type PopoverTriggerMode,
} from "./popover-context";
import { usePopoverBehavior } from "./use-behavior";

/** Props for popover. */
export interface PopoverProps {
  /** Popover.Trigger and Popover.Content subparts. */
  children: ReactNode;
  /** Controlled open state. Pair with onOpenChange. */
  open?: boolean;
  /** Initial open state for uncontrolled mode. */
  defaultOpen?: boolean;
  /** Fired when the open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Click toggles; hover delays pointer-open, keyboard focus opens immediately, and leave closes. */
  triggerMode?: PopoverTriggerMode;
  /** Overrides the auto-detected aria-haspopup value applied to the trigger. */
  popupRole?: PopoverPopupRole;
  /** When false, the popover never opens and trigger handlers are no-ops. */
  enabled?: boolean;
  /** Hover mode only. Delay before opening after pointer enter; keyboard focus opens immediately. */
  delayMs?: number;
  /** Delay before closing after hover/focus leaves the trigger or content. */
  closeDelayMs?: number;
}

/** Root - manages open state, trigger mode (click/hover), delay. */
export function PopoverRoot({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  triggerMode = "click",
  popupRole: popupRoleProp,
  enabled = true,
  delayMs = 500,
  closeDelayMs: closeDelayMsProp,
}: PopoverProps) {
  const closeDelayMs = closeDelayMsProp ?? (triggerMode === "hover" ? 150 : 0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverId = useId();

  const [openState, setOpenState] = useControllableState<boolean>({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChangeProp,
  });

  const behavior = usePopoverBehavior({
    open: openState,
    onOpenChange: setOpenState,
    enabled,
    triggerMode,
    delayMs,
    closeDelayMs,
    triggerRef,
  });
  const contentPopupRole = triggerMode === "click" ? getContentPopupRole(children) : undefined;

  // usePopoverBehavior returns fresh handlers every render (they close over the
  // current open/enabled state), so a useMemo here could never hit — building
  // the context value inline is honest about that.
  const ctx: PopoverContextValue = {
    open: openState && enabled,
    triggerRef,
    popoverId,
    triggerMode,
    popupRole: popupRoleProp ?? contentPopupRole,
    onOpenChange: setOpenState,
    onTriggerEnter: behavior.onTriggerEnter,
    onTriggerFocus: behavior.onTriggerFocus,
    onTriggerLeave: behavior.onTriggerLeave,
    onTriggerBlur: behavior.onTriggerBlur,
    onTriggerClick: behavior.onTriggerClick,
    onTriggerPointerDown: behavior.onTriggerPointerDown,
    markDismissed: behavior.markDismissed,
    onContentEnter: behavior.onContentEnter,
    onContentLeave: behavior.onContentLeave,
    enabled,
  };

  return <PopoverContext value={ctx}>{children}</PopoverContext>;
}

function getContentPopupRole(children: ReactNode): PopoverPopupRole | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ role?: PopoverPopupRole; children?: ReactNode }>(child)) continue;
    if (child.type === PopoverContent) return child.props.role;
    const nestedRole = getContentPopupRole(child.props.children);
    if (nestedRole !== undefined) return nestedRole;
  }
  return undefined;
}
