"use client";

import {
  PopoverTrigger as TooltipTrigger,
  type PopoverTriggerProps as TooltipTriggerProps,
  type PopoverTriggerRenderProps as TooltipTriggerRenderProps,
} from "../popover/popover-trigger";
import { type TooltipProps, TooltipRoot } from "./tooltip";
import { TooltipContent, type TooltipContentProps } from "./tooltip-content";

/** Root - manages hover state, delay, and enabled toggle. */
const Tooltip = Object.assign(TooltipRoot, {
  Trigger: TooltipTrigger,
  Content: TooltipContent,
});

export { Tooltip, type TooltipProps };
export {
  TooltipTrigger,
  TooltipContent,
  type TooltipTriggerProps,
  type TooltipTriggerRenderProps,
  type TooltipContentProps,
};
