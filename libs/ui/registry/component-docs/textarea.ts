import type { ComponentDoc } from "./types"

export const textareaDoc: ComponentDoc = {
  description:
    "Terminal-styled multi-line text area with size variants and invalid state. Shares base styling with Input via input-variants.",
  notes: [
    {
      title: "Invalid State",
      content:
        "Set aria-invalid=true to apply the destructive border treatment. Field.Control sets aria-invalid automatically when Field.invalid is true.",
    },
  ],
  usage: { example: "textarea-default" },
  examples: [
    { name: "textarea-default", title: "Default" },
    { name: "textarea-variants", title: "Variants" },
  ],
  keyboard: null,
  props: {
    Textarea: {
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Height/padding/font size token.",
      },
      "aria-invalid": {
        type: 'boolean | "true" | "false" | "grammar" | "spelling"',
        required: false,
        defaultValue: null,
        description: "The native ARIA invalid state. The destructive border treatment applies to true/\"true\". Field.Control sets this automatically when Field.invalid is true.",
      },
    },
  },
}
