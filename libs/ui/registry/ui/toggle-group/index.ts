import { ToggleGroup as ToggleGroupRoot, type ToggleGroupProps } from "./toggle-group";
import { ToggleGroupItem, type ToggleGroupItemProps } from "./toggle-group-item";

const ToggleGroup = Object.assign(ToggleGroupRoot, {
  Item: ToggleGroupItem,
});

export { ToggleGroup, type ToggleGroupProps };
export { ToggleGroupItem, type ToggleGroupItemProps };
