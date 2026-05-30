import type { ComponentDoc } from "./types"

export const radioDoc: ComponentDoc = {
  description:
    "Terminal-styled radio button and radio group for single-selection.",
  anatomy: [
    { name: "Radio", indent: 0, note: "Standalone radio button (controlled or uncontrolled)" },
    {
      name: "RadioGroup",
      indent: 0,
      note: "Group root with context, selection state, and keyboard navigation",
    },
    {
      name: "RadioGroupItem / RadioGroup.Item",
      indent: 1,
      note: "Group-aware radio item that reads selection from context",
    },
  ],
  notes: [
    {
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "RadioGroup's roving keyboard navigation imports from the optional @diffgazer/keys peer. Package/npm consumers must install it: `npm install @diffgazer/keys`. Importing @diffgazer/ui/components/radio without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
    {
      title: "Composition Contract",
      content:
        "Prefer importing RadioGroup and RadioGroupItem for shadcn-like code. RadioGroup.Item is the same item component exposed for Radix-like namespacing. Use either form inside RadioGroup, directly or through your own wrapper components. Every item value must be unique within a group because selection, highlighting, and form output are value-based.",
    },
    {
      title: "Keyboard Navigation",
      content:
        "RadioGroup delegates roving focus to @diffgazer/keys navigation. All four arrow keys move focus and select items by default regardless of orientation (per WAI-ARIA APG radio group pattern). Home/End jump to first/last item. Space selects the focused item. Enter commit is a Diffgazer extension for preview/commit flows, not the APG baseline. Use activationMode=\"manual\" with onNavigate/onChange when arrows should move focus and highlight without changing value, and onEnter when Enter should commit the focused item. Use autoFocus to focus the highlighted, selected, or first enabled item when the group becomes active. Use keyboardNavigation to suspend RadioGroup-managed key handling; when suspended, enabled items remain tabbable. Use onNavigationBoundaryReached(direction, event, key) to hand focus to adjacent controls and filter vertical-only handoffs by key when needed.",
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
      "All four arrow keys move focus and select items in automatic activation mode (per WAI-ARIA APG). Manual activation mode moves focus and emits onNavigate without changing value. Space selects the focused item. Enter commit via onEnter is a Diffgazer extension for preview/commit flows. Home/End jump to first/last item. Composite UIs can opt into initial focus with autoFocus, suspend RadioGroup-managed key handling with keyboardNavigation, and listen for onNavigationBoundaryReached(direction, event, key).",
    examples: [
      { name: "radio-group-default", title: "Default" },
    ],
  },
  props: {
    Radio: {
      checked: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled checked state.",
      },
      defaultChecked: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Initial checked state for uncontrolled usage.",
      },
      onChange: {
        type: "(checked: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Called when the boolean checked state changes.",
      },
      value: {
        type: "string",
        required: false,
        defaultValue: '"on"',
        description: "Hidden native input value used for form submission.",
      },
      name: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Hidden native input name used for same-name radio behavior and form submission.",
      },
      required: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Marks the hidden native radio input as required.",
      },
      label: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Visible label associated with the custom radio.",
      },
      description: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Visible description wired with aria-describedby.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the custom control and hidden input.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Selectable control size token.",
      },
      variant: {
        type: '"x" | "bullet"',
        required: false,
        defaultValue: '"bullet"',
        description: "Indicator style.",
      },
    },
    RadioGroup: {
      value: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Controlled selected value.",
      },
      defaultValue: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Initial selected value for uncontrolled usage.",
      },
      onChange: {
        type: "(value: string) => void",
        required: false,
        defaultValue: null,
        description: "Called when the selected value changes.",
      },
      highlighted: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: "Controlled highlighted item value for keyboard navigation.",
      },
      onHighlightChange: {
        type: "(value: string | null) => void",
        required: false,
        defaultValue: null,
        description: "Called when keyboard navigation highlights a new item or clears highlight.",
      },
      onNavigate: {
        type: '(value: string, direction: "previous" | "next" | "first" | "last") => void',
        required: false,
        defaultValue: null,
        description: "Called when arrow, Home, or End navigation moves to an item.",
      },
      onEnter: {
        type: "(value: string, event: KeyboardEvent) => void",
        required: false,
        defaultValue: null,
        description: "Called when Enter commits the focused item.",
      },
      orientation: {
        type: '"vertical" | "horizontal"',
        required: false,
        defaultValue: '"vertical"',
        description: "Layout orientation. All four arrow keys still navigate per APG radio behavior.",
      },
      activationMode: {
        type: '"automatic" | "manual"',
        required: false,
        defaultValue: '"automatic"',
        description: "Automatic selects on arrow navigation; manual moves focus/highlight until Space or Enter commits.",
      },
      wrap: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Whether arrow-key navigation wraps at the first and last item.",
      },
      keyboardNavigation: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Enable built-in arrow-key navigation.",
      },
      onNavigationBoundaryReached: {
        type: '(direction: "previous" | "next", event: KeyboardEvent, key: string) => void',
        required: false,
        defaultValue: null,
        description: "Called when non-wrapping navigation reaches the first or last item.",
      },
      autoFocus: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Focuses the highlighted, selected, or first enabled item when the group becomes active.",
      },
      name: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Shared hidden native input name for grouped form submission.",
      },
      required: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Requires one enabled item to be selected.",
      },
    },
    RadioGroupItem: {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Item value. Must be unique within the group.",
      },
      label: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Visible item label.",
      },
      description: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Visible item description wired with aria-describedby.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the item.",
      },
    },
  },
}
