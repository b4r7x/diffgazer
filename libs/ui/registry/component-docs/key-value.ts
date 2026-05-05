import type { ComponentDoc } from "./types"

export const keyValueDoc: ComponentDoc = {
  description:
    "Compound component for displaying labeled data. KeyValue wraps one or more KeyValue.Item rows in a semantic description list.",
  notes: [
    {
      title: "When to use KeyValue vs Label",
      content:
        "Use KeyValue for structured multi-row data display (metadata panels, commit info). Use Label for form field labeling.",
    },
    {
      title: "Compound Usage",
      content:
        "Always wrap KeyValue.Item inside KeyValue — this produces a proper <dl> list. For a single pair: <KeyValue><KeyValue.Item label='...' value='...' /></KeyValue>.",
    },
    {
      title: "Color Variants",
      content:
        "5 semantic color variants (default, warning, info, success, error) style the value text. The info variant uses monospace font instead of bold.",
    },
    {
      title: "Bordered Rows",
      content:
        "Set bordered on KeyValue.Item to add a bottom border, vertical padding, and compact text-xs sizing — ideal for stacked list layouts.",
    },
    {
      title: "Layout Options",
      content:
        "Horizontal layout (default) places label and value side-by-side. Vertical layout stacks them with a small gap. Both label and value accept ReactNode.",
    },
  ],
  usage: { example: "key-value-default" },
  examples: [
    { name: "key-value-default", title: "Default" },
    { name: "key-value-variants", title: "Variants" },
    { name: "key-value-bordered", title: "Bordered" },
    { name: "key-value-list", title: "List" },
  ],
  keyboard: null,
}
