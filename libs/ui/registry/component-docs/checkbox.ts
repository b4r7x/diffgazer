import type { ComponentDoc } from "./types"

export const checkboxDoc: ComponentDoc = {
  description:
    "Terminal-styled checkbox with [x] and bullet variants. Standalone or CheckboxGroup with built-in arrow navigation.",
  anatomy: [
    {
      name: "Checkbox",
      indent: 0,
      note: "Standalone checkbox (controlled or uncontrolled)",
    },
    {
      name: "CheckboxGroup",
      indent: 0,
      note: "Multi-select group with context and keyboard navigation",
    },
    {
      name: "CheckboxItem",
      indent: 1,
      note: "Group-aware checkbox that reads context for state",
    },
  ],
  notes: [
    {
      title: "Indeterminate State",
      content:
        "Checkbox supports a third state: checked='indeterminate' renders [-] (x variant) or [ - ] (bullet variant). This is useful for parent checkboxes representing partially-selected groups.",
    },
    {
      title: "Built-in Navigation",
      content:
        "CheckboxGroup handles arrow-key focus with wrapping through useNavigation. Use highlighted, onHighlightChange, and onKeyDown only when coordinating highlight state or composing extra shortcuts. Space toggling is handled by each CheckboxItem.",
    },
    {
      title: "Strikethrough (Checklist Mode)",
      content:
        "Pass strikethrough to Checkbox or CheckboxGroup to apply line-through styling and muted color to checked item labels. This replaces the former Checklist component with full checkbox features (variants, sizes, keyboard nav, accessibility).",
    },
  ],
  usage: { example: "checkbox-default" },
  examples: [
    { name: "checkbox-default", title: "Default" },
    { name: "checkbox-variants", title: "Variants" },
    { name: "checkbox-group", title: "Group" },
    { name: "checkbox-checklist", title: "Checklist" },
  ],
  keyboard: {
    description:
      "CheckboxGroup includes arrow-key navigation with wrapping. Control highlighted/onHighlightChange when external state coordination is needed, and use onKeyDown for additional shortcuts. Standalone Checkbox responds to Space when focused.",
    examples: [
      { name: "checkbox-group", title: "Group with built-in keyboard navigation" },
    ],
  },
}
