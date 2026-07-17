import type { ComponentDoc } from "./types";

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
        "Use InputGroup for prefix and suffix content around a text input. Plain text and number affixes are decorative by default; set prefixAriaHidden or suffixAriaHidden to false when that text contributes meaning. Non-text affixes remain exposed by default and can be hidden explicitly. Interactive affixes must remain exposed and provide their own accessible labels. Use Field when you need label, description, and error wiring.",
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
        type: 'boolean | "true" | "false" | "grammar" | "spelling"',
        required: false,
        defaultValue: null,
        description:
          'The native ARIA invalid state. The destructive border treatment applies to true/"true". Field.Control sets this automatically when Field.invalid is true.',
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
        description:
          "Decorative content rendered before the input. Plain text is aria-hidden; interactive affixes must provide their own accessible labels.",
      },
      suffix: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Decorative content rendered after the input. Plain text is aria-hidden; interactive affixes must provide their own accessible labels.",
      },
      prefixAriaHidden: {
        type: "boolean",
        required: false,
        defaultValue: "true for string/number prefixes; false otherwise",
        description:
          "Controls whether the prefix wrapper is hidden from assistive technology. Overrides the content-based default.",
      },
      suffixAriaHidden: {
        type: "boolean",
        required: false,
        defaultValue: "true for string/number suffixes; false otherwise",
        description:
          "Controls whether the suffix wrapper is hidden from assistive technology. Overrides the content-based default.",
      },
      inputClassName: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "className applied to the inner input element. The outer className targets the wrapper.",
      },
    },
  },
};
