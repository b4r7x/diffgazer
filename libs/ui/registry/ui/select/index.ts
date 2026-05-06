import { Select as SelectRoot, type SelectProps } from "./select";
import { SelectTrigger, type SelectTriggerProps } from "./select-trigger";
import { SelectContent, type SelectContentProps } from "./select-content";
import { SelectItem, type SelectItemProps } from "./select-item";
import { SelectSearch, type SelectSearchProps } from "./select-search";
import { SelectValue, type SelectValueProps, type SelectValueDisplay, type SelectValueRenderProps } from "./select-value";
import { SelectEmpty, type SelectEmptyProps } from "./select-empty";
import { SelectTags, type SelectTagsProps } from "./select-tags";

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
