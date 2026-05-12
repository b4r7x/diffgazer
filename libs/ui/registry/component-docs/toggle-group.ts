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
      title: "Composition Contract",
      content:
        "Use ToggleGroup.Item as an explicit child in the ToggleGroup JSX tree. Custom item UI belongs inside ToggleGroup.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Keyboard Navigation",
      content:
        "Arrow keys navigate between items with wrapping. Enter/Space activation uses native button semantics. Highlight state can be controlled externally via highlighted and onHighlightChange props. Use onNavigationBoundaryReached for composite focus handoff when wrap is false.",
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
