import type { ComponentDoc } from "./types"

export const radioDoc: ComponentDoc = {
  description:
    "Terminal-styled radio button and radio group for single-selection with bracket notation.",
  anatomy: [
    { name: "Radio", indent: 0, note: "Standalone radio button (controlled or uncontrolled)" },
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
      title: "Composition Contract",
      content:
        "Use RadioGroup.Item inside RadioGroup, directly or through your own wrapper components. Every item value must be unique within a group because selection, highlighting, and form output are value-based.",
    },
    {
      title: "Keyboard Navigation",
      content:
        "RadioGroup implements roving focus locally. All four arrow keys move focus and select items by default regardless of orientation (per WAI-ARIA APG radio group pattern). Home/End jump to first/last item. Space selects the focused item. Use activationMode=\"manual\" with onNavigate/onChange for preview/commit flows where arrows move focus and highlight without changing value, and onEnter when Enter should commit the focused item. Use autoFocus to focus the highlighted, selected, or first enabled item when the group becomes active. Use keyboardNavigation to suspend RadioGroup-managed key handling; when suspended, enabled items remain tabbable. Use onNavigationBoundaryReached to hand focus to adjacent controls.",
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
      "All four arrow keys move focus and select items in automatic activation mode (per WAI-ARIA APG). Manual activation mode moves focus and emits onNavigate without changing value; Space selects the focused item and onEnter can commit the focused item. Home/End jump to first/last item. Composite UIs can opt into initial focus with autoFocus, suspend RadioGroup-managed key handling with keyboardNavigation, and listen for onNavigationBoundaryReached.",
    examples: [
      { name: "radio-group-default", title: "Default" },
    ],
  },
}
