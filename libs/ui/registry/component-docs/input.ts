import type { ComponentDoc } from "./types"

export const inputDoc: ComponentDoc = {
  description:
    "Terminal-styled text input primitives with size variants, error state, and optional prefix/suffix grouping.",
  notes: [
    {
      title: "Error State",
      content:
        "Setting error={true} applies a destructive border color and sets aria-invalid on the element for accessibility.",
    },
    {
      title: "InputGroup",
      content:
        "Use InputGroup for prefix and suffix content around a text input. Use Field when you need label, description, and error wiring.",
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
}
