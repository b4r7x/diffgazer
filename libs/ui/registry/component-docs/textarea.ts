import type { ComponentDoc } from "./types"

export const textareaDoc: ComponentDoc = {
  description:
    "Terminal-styled multi-line text area with size variants and error state. Shares base styling with Input via input-variants.",
  notes: [
    {
      title: "Error State",
      content:
        "Setting error={true} applies a destructive border color and sets aria-invalid on the element for accessibility.",
    },
  ],
  usage: { example: "textarea-default" },
  examples: [
    { name: "textarea-default", title: "Default" },
    { name: "textarea-variants", title: "Variants" },
  ],
  keyboard: null,
}
