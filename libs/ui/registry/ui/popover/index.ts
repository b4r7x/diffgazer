"use client";

import { type PopoverProps, PopoverRoot } from "./popover";
import {
  PopoverContent,
  type PopoverContentProps,
} from "./popover-content";
import type { PopoverPopupRole, PopoverTriggerMode } from "./popover-context";
import {
  PopoverTrigger,
  type PopoverTriggerProps,
  type PopoverTriggerRenderProps,
} from "./popover-trigger";

const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
});

export { Popover, type PopoverProps };
export {
  PopoverTrigger,
  PopoverContent,
  type PopoverPopupRole,
  type PopoverTriggerMode,
  type PopoverTriggerProps,
  type PopoverTriggerRenderProps,
  type PopoverContentProps,
};
