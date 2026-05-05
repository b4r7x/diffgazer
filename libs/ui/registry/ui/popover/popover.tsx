"use client";

import { type ReactNode, useId, useMemo, useRef } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import {
  PopoverContext,
  type PopoverContextValue,
  type PopoverTriggerMode,
} from "./popover-context";
import { usePopoverBehavior } from "./use-popover-behavior";

export interface PopoverProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerMode?: PopoverTriggerMode;
  enabled?: boolean;
  delayMs?: number;
  closeDelayMs?: number;
}

export function PopoverRoot({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  triggerMode = "click",
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

  const ctx: PopoverContextValue = useMemo(() => ({
    open: openState && enabled,
    triggerRef,
    popoverId,
    triggerMode,
    onOpenChange: setOpenState,
    onTriggerEnter: behavior.onTriggerEnter,
    onTriggerLeave: behavior.onTriggerLeave,
    onTriggerClick: behavior.onTriggerClick,
    onContentEnter: behavior.onContentEnter,
    onContentLeave: behavior.onContentLeave,
    enabled,
  }), [openState, enabled, popoverId, triggerMode, setOpenState]);

  return (
    <PopoverContext value={ctx}>{children}</PopoverContext>
  );
}
