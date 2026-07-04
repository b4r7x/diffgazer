import type { ComponentDoc } from "./types";

export const toggleGroupDoc: ComponentDoc = {
  description:
    "Compound toggle button group with keyboard navigation for single or multiple selection.",
  notes: [
    {
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "ToggleGroup's arrow-key navigation imports from the required @diffgazer/keys peer. Package consumers must install @diffgazer/keys with @diffgazer/ui; packages are not yet published to npm, so use a local checkout until the first release. Importing @diffgazer/ui/components/toggle-group without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
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
        "Arrow keys move roving focus with wrapping by default. In single mode, selection follows focus unless allowDeselect is enabled; in multiple mode, arrow keys move focus and Enter/Space toggles the focused item. Highlight state can be controlled externally via highlighted and onHighlightChange props. Use onNavigationBoundaryReached for composite focus handoff when wrap is false.",
    },
    {
      title: "Role semantics",
      content:
        "Single mode without allowDeselect renders as radiogroup/radio with aria-checked because exactly one choice is active. Multiple mode and allow-deselect single mode render as group plus button-style items with aria-pressed because each item is independently toggleable.",
    },
  ],
  usage: { example: "toggle-group-default" },
  examples: [
    { name: "toggle-group-default", title: "Default" },
    { name: "toggle-group-variants", title: "Variants" },
    { name: "toggle-group-counts", title: "With Counts" },
    { name: "toggle-group-multiple", title: "Multiple Selection" },
    { name: "toggle-group-sizes", title: "Sizes" },
    { name: "toggle-group-vertical", title: "Vertical" },
    { name: "toggle-group-disabled", title: "Disabled" },
  ],
  keyboard: {
    description:
      "Arrow keys move focus between toggle items with wrapping. Single mode follows focus; multiple mode and allow-deselect single mode use button semantics and toggle with Enter or Space.",
    keys: [
      {
        keys: "ArrowRight / ArrowDown",
        action: "Moves focus to the next enabled item; wraps when wrap is true.",
      },
      {
        keys: "ArrowLeft / ArrowUp",
        action: "Moves focus to the previous enabled item; wraps when wrap is true.",
      },
      {
        keys: "Home / End",
        action: "Moves focus to the first or last enabled item.",
      },
      {
        keys: "Enter / Space",
        action:
          "Toggles the focused item in multiple mode or allow-deselect single mode; native radio-style single mode changes selection during arrow navigation.",
      },
    ],
    examples: [{ name: "toggle-group-default", title: "With keyboard navigation" }],
  },
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "ToggleGroup.Item",
      values: '"on" | "off"',
      description: "Reflects whether the item is selected.",
    },
    {
      attribute: "data-highlighted",
      appliesTo: "ToggleGroup.Item",
      values: "present when highlighted",
      description: "Marks the roving-focus item.",
    },
    {
      attribute: "data-value",
      appliesTo: "ToggleGroup.Item",
      values: "item value",
      description: "Exposes the item value used for selection and indicator positioning.",
    },
    {
      attribute: "data-variant",
      appliesTo: "ToggleGroup",
      values: '"default" | "pill" | "underline" | "bracket"',
      description: "Reflects the visual variant on the group root.",
    },
    {
      attribute: "data-orientation",
      appliesTo: "ToggleGroup",
      values: '"horizontal" | "vertical"',
      description: "Reflects the layout and arrow-key axis.",
    },
  ],
  props: {
    ToggleGroup: {
      selectionMode: {
        type: '"single" | "multiple"',
        required: false,
        defaultValue: '"single"',
        description:
          "Switches between radio-style single selection and pressed-button-style multiple selection. Switches value/onChange/defaultValue from string|null to readonly string[].",
      },
      value: {
        type: "string | null | readonly string[]",
        required: false,
        defaultValue: null,
        description:
          "Controlled selected value(s). string|null for single mode, readonly string[] for multiple.",
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
        description:
          "Single mode only. When true, clicking the active item deselects it (allowing a null value).",
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
        description:
          "Single mode only. Form field name; renders a hidden input for native form submission.",
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
        description: "Disables this item only; removed from arrow navigation and focus.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Item label.",
      },
    },
  },
};
