"use client";

import { Radio, type RadioProps } from "./radio";
import {
  RadioGroup as RadioGroupRoot,
  type RadioGroupActivationMode,
  type RadioGroupBoundaryDirection,
  type RadioGroupNavigationDirection,
  type RadioGroupProps,
} from "./radio-group";
import { RadioGroupItem, type RadioGroupItemProps } from "./radio-group-item";

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
