import type { ComponentDoc } from "./types"

export const fieldDoc: ComponentDoc = {
  description:
    "Form field primitives that wire labels, controls, descriptions, and validation messages without owning the actual input component.",
  notes: [
    {
      title: "Form Contract",
      content:
        "Field.Control clones one control element and applies id, required, disabled, aria-invalid, and aria-describedby from Field.Root. Use it with Input, Textarea, Select, or another control that accepts those props.",
    },
    {
      title: "InputGroup vs Field",
      content:
        "InputGroup is only a decorated input shell for prefix and suffix content. Plain text affixes are aria-hidden decoration; interactive affixes need explicit labels. Field is the form wrapper for label, helper text, and error wiring.",
    },
  ],
  usage: { example: "field-input" },
  examples: [
    { name: "field-input", title: "Input" },
  ],
  keyboard: null,
}
