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
        "CheckboxGroup handles arrow-key navigation with real focus movement through useNavigation. Use autoFocus to focus the highlighted, selected, or first enabled item when the group becomes active. Use highlighted, onHighlightChange, keyboardNavigation, and onNavigationBoundaryReached when coordinating highlight state across adjacent UI. Every item value must be unique within a group. Space toggling is handled by each CheckboxItem.",
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
    examples: [
      { name: "checkbox-group", title: "Group with built-in keyboard navigation" },
    ],
  },
  props: {
    Checkbox: {
      checked: {
        type: 'boolean | "indeterminate"',
        required: false,
        defaultValue: null,
        description: "Controlled checked state. Use \"indeterminate\" for the mixed visual state.",
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
        type: "(value: string) => void",
        required: false,
        defaultValue: null,
        description: "Called when keyboard navigation highlights a new item.",
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
        description: "Called when non-wrapping navigation reaches the first or last item. Use event/key to decide whether to hand focus to adjacent controls.",
      },
      autoFocus: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Focuses the highlighted, selected, or first enabled item when the group becomes active.",
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
}
