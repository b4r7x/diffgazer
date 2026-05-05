import type { ComponentDoc } from "./types"

export const inputDoc: ComponentDoc = {
  description:
    "Terminal-styled text input with size variants and error state.",
  notes: [
    {
      title: "Error State",
      content:
        "Setting error={true} applies a destructive border color and sets aria-invalid on the element for accessibility.",
    },
  ],
  usage: { example: "input-default" },
  examples: [
    { name: "input-default", title: "Default" },
    { name: "input-variants", title: "Variants" },
    { name: "input-form", title: "Form" },
  ],
  keyboard: null,
}
