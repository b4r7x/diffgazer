import type { ComponentDoc } from "./types"

export const inputDoc: ComponentDoc = {
  description:
    "Terminal-styled text input primitives with size variants, invalid state, and optional prefix/suffix grouping.",
  notes: [
    {
      title: "Invalid State",
      content:
        "Set aria-invalid=true on Input or InputGroup to apply the destructive border treatment. Field.Control sets aria-invalid automatically when Field.invalid is true.",
    },
    {
      title: "InputGroup",
      content:
        "Use InputGroup for prefix and suffix content around a text input. Plain text affixes are treated as decorative. Interactive affixes must provide their own accessible labels. Use Field when you need label, description, and error wiring.",
    },
  ],
  usage: { example: "input-default" },
  examples: [
    { name: "input-default", title: "Default" },
    { name: "input-group", title: "Group" },
    { name: "input-variants", title: "Variants" },
    { name: "input-form", title: "Form" },
  ],
  keyboard: null,
  props: {
    Input: {
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Height/padding/font size token.",
      },
      "aria-invalid": {
        type: "boolean | \"true\" | \"false\" | \"grammar\" | \"spelling\"",
        required: false,
        defaultValue: null,
        description: "The native ARIA invalid state. The destructive border treatment applies to true/\"true\". Field.Control sets this automatically when Field.invalid is true.",
      },
    },
    InputGroup: {
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Height/padding/font size token applied to the wrapper and the inner input.",
      },
      prefix: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Decorative content rendered before the input. Plain text is aria-hidden; interactive affixes must provide their own accessible labels.",
      },
      suffix: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Decorative content rendered after the input. Plain text is aria-hidden; interactive affixes must provide their own accessible labels.",
      },
      inputClassName: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "className applied to the inner input element. The outer className targets the wrapper.",
      },
    },
  },
}
