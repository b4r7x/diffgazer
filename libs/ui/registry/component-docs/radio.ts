import type { ComponentDoc } from "./types"

export const radioDoc: ComponentDoc = {
  description:
    "Terminal-styled radio button and radio group for single-selection with bracket notation.",
  anatomy: [
    { name: "Radio", indent: 0, note: "Standalone radio button (unmanaged)" },
    {
      name: "RadioGroup",
      indent: 0,
      note: "Group root with context, selection state, and keyboard navigation",
    },
    {
      name: "RadioGroupItem",
      indent: 1,
      note: "Group-aware radio that reads selection from context",
    },
  ],
  notes: [
    {
      title: "Keyboard Navigation",
      content:
        "RadioGroup uses @diffgazer/keys's useNavigation hook internally for arrow-key navigation. All four arrow keys move focus and select items regardless of orientation (per WAI-ARIA APG radio group pattern). Home/End jump to first/last item. Space selects the focused item.",
    },
    {
      title: "Orientation",
      content:
        "Set orientation='horizontal' for inline layouts. Layout direction changes but all four arrow keys always navigate (per APG spec).",
    },
  ],
  usage: { example: "radio-group-default" },
  examples: [
    { name: "radio-group-default", title: "Default" },
    { name: "radio-group-variants", title: "Variants" },
  ],
  keyboard: {
    description:
      "All four arrow keys move focus and select items (per WAI-ARIA APG). Home/End jump to first/last item. Space selects the focused item.",
    examples: [
      { name: "radio-group-default", title: "Default" },
    ],
  },
}
