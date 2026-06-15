import type { ComponentDoc } from "./types";

export const switchDoc: ComponentDoc = {
  description:
    'Terminal-styled binary toggle switch. Uses role="switch" with checked/defaultChecked/onChange(boolean) pattern and a hidden native checkbox for form submission.',
  anatomy: [
    {
      name: "Switch",
      indent: 0,
      note: "Binary toggle (controlled or uncontrolled)",
    },
  ],
  notes: [
    {
      title: "Form Submission",
      content:
        'Switch renders a hidden native checkbox when name or required is set. The value prop controls the form-submission string (default "on").',
    },
  ],
  usage: { example: "switch-default" },
  examples: [
    { name: "switch-default", title: "Default" },
    { name: "switch-controlled", title: "Controlled" },
  ],
  keyboard: {
    description:
      "Switch renders a native button with role=switch, so keyboard activation follows button semantics.",
    keys: [
      { keys: "Space", action: "Toggles the checked state when the switch is focused." },
      { keys: "Enter", action: "Toggles the checked state when the switch is focused." },
    ],
    examples: [{ name: "switch-default", title: "Default" }],
  },
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "Switch",
      values: '"checked" | "unchecked"',
      description: "Reflects the checked state for track and thumb styling.",
    },
    {
      attribute: "data-disabled",
      appliesTo: "Switch",
      values: "present when disabled",
      description: "Marks the disabled state for styling hooks.",
    },
  ],
  props: {
    Switch: {
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
        description: "Hidden native input name used for form submission.",
      },
      required: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Marks the hidden native checkbox as required.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the switch and hidden input.",
      },
      size: {
        type: '"sm" | "md"',
        required: false,
        defaultValue: '"md"',
        description: "Switch size token.",
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Accessible name for the switch when no visible label labels it.",
      },
      "aria-labelledby": {
        type: "string",
        required: false,
        defaultValue: null,
        description: "ID reference for visible text that labels the switch.",
      },
      "aria-describedby": {
        type: "string",
        required: false,
        defaultValue: null,
        description: "ID reference for helper or error text describing the switch.",
      },
      "aria-invalid": {
        type: "boolean | 'true' | 'false' | 'grammar' | 'spelling'",
        required: false,
        defaultValue: null,
        description:
          "Invalid state override. Field.Control also forwards its invalid state to this prop.",
      },
    },
  },
};
