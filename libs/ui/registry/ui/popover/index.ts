import { PopoverRoot, type PopoverProps } from "./popover";
import {
  PopoverTrigger,
  type PopoverTriggerProps,
  type PopoverTriggerRenderProps,
} from "./popover-trigger";
import {
  PopoverContent,
  type PopoverContentProps,
} from "./popover-content";

const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
});

export { Popover, type PopoverProps };
export {
  PopoverTrigger,
  PopoverContent,
  type PopoverTriggerProps,
  type PopoverTriggerRenderProps,
  type PopoverContentProps,
};
