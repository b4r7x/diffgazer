import type { ComponentDoc } from "./types"

export const checkboxDoc: ComponentDoc = {
  description:
    "Terminal-styled checkbox with [x] and bullet variants. Standalone or CheckboxGroup with headless focus and keyboard hooks.",
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
      title: "External Navigation",
      content:
        "CheckboxGroup is headless for keyboard behavior. Wire arrow-key focus from your app layer using highlighted, onHighlightChange, and onKeyDown (see checkbox-group example for @diffgazer/keys integration). Space toggling is handled by each CheckboxItem.",
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
      "CheckboxGroup exposes headless keyboard hooks. Integrate @diffgazer/keys (or your own handler) by controlling highlighted and handling onKeyDown at the group level. Standalone Checkbox responds to Space when focused (per WAI-ARIA APG checkbox pattern).",
    examples: [
      { name: "checkbox-group", title: "Group with @diffgazer/keys navigation" },
    ],
  },
}
