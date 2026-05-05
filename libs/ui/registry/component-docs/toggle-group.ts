import type { ComponentDoc } from "./types"

export const toggleGroupDoc: ComponentDoc = {
  description:
    "Compound toggle button group with keyboard navigation for single selection.",
  notes: [
    {
      title: "Compound Component",
      content:
        "ToggleGroup uses compound sub-components (ToggleGroup.Item) rather than a data array. Each item accepts children for the label and an optional count prop that renders as [label count].",
    },
    {
      title: "Keyboard Navigation",
      content:
        "Arrow keys navigate between items with wrapping. Enter/Space activation uses native button semantics. Highlight state can be controlled externally via highlighted and onHighlightChange props.",
    },
  ],
  usage: { example: "toggle-group-default" },
  examples: [
    { name: "toggle-group-default", title: "Default" },
    { name: "toggle-group-counts", title: "With Counts" },
  ],
  keyboard: {
    description:
      "Arrow keys move focus between toggle items with wrapping. Enter and Space select the focused item.",
    examples: [
      { name: "toggle-group-default", title: "With keyboard navigation" },
    ],
  },
}
