import type { ComponentDoc } from "./types";

export const textareaDoc: ComponentDoc = {
  description:
    "Terminal-styled multi-line text area with size variants and invalid state. Shares base styling with Input via input-variants.",
  notes: [
    {
      title: "Read-only vs Disabled",
      content:
        "Textarea styles the two states on different channels so they cannot be confused. Disabled dashes the border and dims the ink: the field is not part of this form. Read-only fills the surface with the recessed token and keeps full-contrast ink: the value matters, it just cannot be edited. A read-only field stays focusable and copyable, and the focus ring still applies on top of the fill because one is an edge and the other a surface.",
    },

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
    { name: "textarea-focus", title: "Focus" },
  ],
  keyboard: null,
  props: {
    Textarea: {
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description:
          "Padding, font-size, and min-height token. Every size stays vertically resizable.",
      },
      "aria-invalid": {
        type: 'boolean | "true" | "false" | "grammar" | "spelling"',
        required: false,
        defaultValue: null,
        description:
          'The native ARIA invalid state. The destructive border treatment applies to true/"true". Field.Control sets this automatically when Field.invalid is true.',
      },
    },
  },
};
