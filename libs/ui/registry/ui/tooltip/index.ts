import { TooltipRoot, type TooltipProps } from "./tooltip";
import {
  PopoverTrigger as TooltipTrigger,
  type PopoverTriggerProps as TooltipTriggerProps,
  type PopoverTriggerRenderProps as TooltipTriggerRenderProps,
} from "../popover/popover-trigger";
import {
  TooltipContent,
  type TooltipContentProps,
} from "./tooltip-content";

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
