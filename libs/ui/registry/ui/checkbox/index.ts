import { Checkbox as CheckboxRoot, type CheckboxProps, type CheckboxVariant } from "./checkbox";
import { CheckboxGroup, type CheckboxGroupProps } from "./checkbox-group";
import { CheckboxItem, type CheckboxItemProps } from "./checkbox-item";

const Checkbox = Object.assign(CheckboxRoot, {
  Group: CheckboxGroup,
  Item: CheckboxItem,
});

export { Checkbox, type CheckboxProps, type CheckboxVariant };
export { CheckboxGroup, type CheckboxGroupProps };
export { CheckboxItem, type CheckboxItemProps };
