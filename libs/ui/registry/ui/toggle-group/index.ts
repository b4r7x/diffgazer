"use client";

import { type ToggleGroupProps, ToggleGroup as ToggleGroupRoot } from "./toggle-group";
import { ToggleGroupItem, type ToggleGroupItemProps } from "./toggle-group-item";

/** Compound toggle button group with keyboard navigation for single or multiple selection. */
const ToggleGroup = Object.assign(ToggleGroupRoot, {
  Item: ToggleGroupItem,
});

export { ToggleGroup, type ToggleGroupProps };
export { ToggleGroupItem, type ToggleGroupItemProps };
