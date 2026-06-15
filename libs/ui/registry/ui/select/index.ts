"use client";

import { type SelectProps, Select as SelectRoot } from "./select";
import { SelectContent, type SelectContentProps } from "./select-content";
import { SelectEmpty, type SelectEmptyProps } from "./select-empty";
import { SelectItem, type SelectItemProps } from "./select-item";
import { SelectSearch, type SelectSearchProps } from "./select-search";
import { SelectTags, type SelectTagsProps } from "./select-tags";
import { SelectTrigger, type SelectTriggerProps } from "./select-trigger";
import {
  SelectValue,
  type SelectValueDisplay,
  type SelectValueProps,
  type SelectValueRenderProps,
} from "./select-value";

/**
 * Dropdown select with search, multiple selection, card variant, and controlled keyboard
 * integration points. 8 composable parts.
 */
const Select = Object.assign(SelectRoot, {
  Trigger: SelectTrigger,
  Content: SelectContent,
  Item: SelectItem,
  Search: SelectSearch,
  Value: SelectValue,
  Empty: SelectEmpty,
  Tags: SelectTags,
});

export { Select, type SelectProps };
export { SelectTrigger, type SelectTriggerProps };
export { SelectContent, type SelectContentProps };
export { SelectItem, type SelectItemProps };
export { SelectSearch, type SelectSearchProps };
export { SelectValue, type SelectValueProps, type SelectValueDisplay, type SelectValueRenderProps };
export { SelectEmpty, type SelectEmptyProps };
export { SelectTags, type SelectTagsProps };
