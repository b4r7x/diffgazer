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
  props: {
    ToggleGroup: {
      selectionMode: {
        type: '"single" | "multiple"',
        required: false,
        defaultValue: '"single"',
        description: 'Switches between radio-style single selection and pressed-button-style multiple selection. Switches value/onChange/defaultValue from string|null to readonly string[].',
      },
      value: {
        type: "string | null | readonly string[]",
        required: false,
        defaultValue: null,
        description: "Controlled selected value(s). string|null for single mode, readonly string[] for multiple.",
      },
      defaultValue: {
        type: "string | null | readonly string[]",
        required: false,
        defaultValue: "null (single) | [] (multiple)",
        description: "Initial selected value(s) for uncontrolled mode.",
      },
      onChange: {
        type: "(value: string | null) => void | (value: readonly string[]) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the selected value(s) change.",
      },
      allowDeselect: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Single mode only. When true, clicking the active item deselects it (allowing a null value).",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the entire group.",
      },
      size: {
        type: '"sm" | "md"',
        required: false,
        defaultValue: '"sm"',
        description: "Item size token.",
      },
      orientation: {
        type: '"horizontal" | "vertical"',
        required: false,
        defaultValue: '"horizontal"',
        description: "Layout axis and arrow-key navigation direction.",
      },
      wrap: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "When true, arrow navigation wraps and horizontal items flex-wrap.",
      },
      highlighted: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: "Controlled highlighted (focused) value for cross-component navigation.",
      },
      onHighlightChange: {
        type: "(value: string | null) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the highlighted value changes.",
      },
      onNavigationBoundaryReached: {
        type: '(direction: "previous" | "next", event: KeyboardEvent, key: string) => void',
        required: false,
        defaultValue: null,
        description: "Fired when arrow navigation reaches the first/last item with wrap disabled.",
      },
      label: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Accessible name for the group container.",
      },
      "aria-labelledby": {
        type: "string",
        required: false,
        defaultValue: null,
        description: "ID of the element labelling the group.",
      },
      name: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Single mode only. Form field name; renders a hidden input for native form submission.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "ToggleGroup.Item children.",
      },
    },
    "ToggleGroup.Item": {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier matched against the group value.",
      },
      count: {
        type: "number",
        required: false,
        defaultValue: null,
        description: "Optional trailing count rendered as [label count].",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables this item only; remains in the navigation order with aria-disabled.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Item label.",
      },
    },
  },
}
