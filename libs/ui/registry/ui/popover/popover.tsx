"use client";

import { Children, isValidElement, type ReactNode, useId, useMemo, useRef } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { PopoverContent } from "./popover-content";
import {
  PopoverContext,
  type PopoverContextValue,
  type PopoverPopupRole,
  type PopoverTriggerMode,
} from "./popover-context";
import { usePopoverBehavior } from "./use-behavior";

export interface PopoverProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerMode?: PopoverTriggerMode;
  popupRole?: PopoverPopupRole;
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

  const ctx: PopoverContextValue = useMemo(
    () => ({
      open: openState && enabled,
      triggerRef,
      popoverId,
      triggerMode,
      popupRole: popupRoleProp ?? contentPopupRole,
      onOpenChange: setOpenState,
      onTriggerEnter: behavior.onTriggerEnter,
      onTriggerLeave: behavior.onTriggerLeave,
      onTriggerClick: behavior.onTriggerClick,
      onContentEnter: behavior.onContentEnter,
      onContentLeave: behavior.onContentLeave,
      enabled,
    }),
    [
      openState,
      enabled,
      popoverId,
      triggerMode,
      popupRoleProp,
      contentPopupRole,
      setOpenState,
      behavior,
    ],
  );

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
