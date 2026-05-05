"use client";

import type { ReactNode } from "react";
import { PopoverRoot } from "../popover/popover";
import { PopoverTrigger } from "../popover/popover-trigger";
import { TooltipContent } from "./tooltip-content";

export interface TooltipProps {
  children: ReactNode;
  content?: ReactNode;
  enabled?: boolean;
  delayMs?: number;
  closeDelayMs?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

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

