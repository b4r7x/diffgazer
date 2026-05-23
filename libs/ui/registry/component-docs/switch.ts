import type { ComponentDoc } from "./types"

export const switchDoc: ComponentDoc = {
  description:
    "Terminal-styled binary toggle switch. Uses role=\"switch\" with checked/defaultChecked/onChange(boolean) pattern and a hidden native checkbox for form submission.",
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
        "Switch renders a hidden native checkbox when name or required is set. The value prop controls the form-submission string (default \"on\").",
    },
    {
      title: "Keyboard",
      content:
        "Switch uses a native button element, so Space and Enter toggle the state by default.",
    },
  ],
  usage: { example: "switch-default" },
  examples: [
    { name: "switch-default", title: "Default" },
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
    },
  },
}
