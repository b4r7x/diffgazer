"use client";

import { Radio, type RadioProps } from "./radio";
import {
  type RadioGroupActivationMode,
  type RadioGroupBoundaryDirection,
  type RadioGroupNavigationDirection,
  type RadioGroupProps,
  RadioGroup as RadioGroupRoot,
} from "./radio-group";
import { RadioGroupItem, type RadioGroupItemProps } from "./radio-group-item";

/** Group root with context, selection state, and keyboard navigation. */
const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});

export { Radio, type RadioProps };
export {
  RadioGroup,
  type RadioGroupActivationMode,
  type RadioGroupBoundaryDirection,
  type RadioGroupNavigationDirection,
  type RadioGroupProps,
};
export { RadioGroupItem, type RadioGroupItemProps };
