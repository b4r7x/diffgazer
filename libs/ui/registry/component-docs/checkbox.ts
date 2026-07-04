import type { ComponentDoc } from "./types";

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
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "CheckboxGroup's arrow-key navigation imports from the required @diffgazer/keys peer. Package consumers must install @diffgazer/keys with @diffgazer/ui; packages are not yet published to npm, so use a local checkout until the first release. Importing @diffgazer/ui/components/checkbox without keys fails at module load with an error naming the missing @diffgazer/keys package. Standalone Checkbox still needs it because the subpath bundles the group. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
    {
      title: "Indeterminate State",
      content:
        "Checkbox supports a third state: checked='indeterminate' renders [-] (x variant) or [ - ] (bullet variant). This is useful for parent checkboxes representing partially-selected groups.",
    },
    {
      title: "Built-in Navigation",
      content:
        "CheckboxGroup handles arrow-key navigation with real focus movement through useNavigation. Enter toggles the focused/highlighted enabled item; Space continues to work through native/item semantics. Use autoFocus to focus the highlighted, selected, or first enabled item when the group becomes active. Use highlighted, onHighlightChange, keyboardNavigation, and onNavigationBoundaryReached when coordinating highlight state across adjacent UI. Every item value must be unique within a group.",
    },
    {
      title: "Strikethrough (Checklist Mode)",
      content:
        "Pass strikethrough to Checkbox or CheckboxGroup to apply line-through styling and muted color to checked item labels.",
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
      "CheckboxGroup includes arrow-key navigation with wrapping and real focus movement. Control highlighted/onHighlightChange when external state coordination is needed, use autoFocus when activating a composite region, use keyboardNavigation to suspend only arrow handling, and use onNavigationBoundaryReached for composite focus handoff. Standalone Checkbox responds to Space when focused.",
    keys: [
      { keys: "Space", action: "Toggles a focused standalone Checkbox or CheckboxItem." },
      {
        keys: "ArrowUp / ArrowDown",
        action: "Moves focus to the previous or next enabled CheckboxItem inside CheckboxGroup.",
      },
      { keys: "Home / End", action: "Moves focus to the first or last enabled item." },
      { keys: "Enter", action: "Toggles the focused/highlighted enabled group item." },
    ],
    examples: [{ name: "checkbox-group", title: "Group with built-in keyboard navigation" }],
  },
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "Checkbox / CheckboxItem",
      values: '"checked" | "unchecked" | "indeterminate"',
      description: "Boolean visual state for styling the custom control.",
    },
    {
      attribute: "data-disabled",
      appliesTo: "Checkbox / CheckboxItem",
      values: "present when disabled",
      description: "Marks disabled controls and group items.",
    },
    {
      attribute: "data-highlighted",
      appliesTo: "Checkbox / CheckboxItem",
      values: "present when highlighted",
      description: "Marks the current keyboard-highlighted group item.",
    },
    {
      attribute: "data-value",
      appliesTo: "Checkbox / CheckboxItem",
      values: "item value",
      description: "Stable item value used by group navigation and form submission wiring.",
    },
    {
      attribute: "data-diffgazer-selectable-owner",
      appliesTo: "CheckboxGroup",
      values: '"checkbox"',
      description: "Scopes nested selectable-item discovery for keyboard navigation.",
    },
  ],
  props: {
    Checkbox: {
      checked: {
        type: 'boolean | "indeterminate"',
        required: false,
        defaultValue: null,
        description: 'Controlled checked state. Use "indeterminate" for the mixed visual state.',
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
        description: "Hidden native input name used for form submission.",
      },
      required: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Marks the hidden native checkbox as required.",
      },
      label: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Visible label associated with the custom checkbox.",
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
        defaultValue: '"x"',
        description: "Indicator style.",
      },
      strikethrough: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Applies muted line-through styling to the label when checked.",
      },
    },
    CheckboxGroup: {
      value: {
        type: "string[]",
        required: false,
        defaultValue: null,
        description: "Controlled selected item values.",
      },
      defaultValue: {
        type: "string[]",
        required: false,
        defaultValue: "[]",
        description: "Initial selected values for uncontrolled usage.",
      },
      onChange: {
        type: "(value: string[]) => void",
        required: false,
        defaultValue: null,
        description: "Called when the selected values change.",
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
        description:
          "Called when non-wrapping navigation reaches the first or last item. Use event/key to decide whether to hand focus to adjacent controls.",
      },
      autoFocus: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Focuses the highlighted, selected, or first enabled item when the group becomes active.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the group and all items.",
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
        description: "Requires at least one enabled item to be selected.",
      },
      label: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "Visible group label rendered before the items. Also names the group unless aria-label overrides it.",
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "Explicit accessible name for the group. Overrides the visible label when supplied.",
      },
      "aria-labelledby": {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "ID reference for an external label. Composed with the visible label unless aria-label is supplied.",
      },
    },
    CheckboxItem: {
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
};
