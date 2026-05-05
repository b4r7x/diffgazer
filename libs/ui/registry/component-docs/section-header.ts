import type { ComponentDoc } from "./types"

export const sectionHeaderDoc: ComponentDoc = {
  description:
    "Uppercase heading element for labeling content sections, with configurable heading level and variant.",
  notes: [
    {
      title: "Variant",
      content: "The variant prop controls visual intensity. Default uses foreground color, muted uses muted-foreground.",
    },
    {
      title: "Heading Level",
      content: "The as prop renders as h2, h3, or h4 (defaults to h3). All levels share the same uppercase tracking-wider styling.",
    },
  ],
  usage: { example: "section-header-default" },
  examples: [
    { name: "section-header-default", title: "Default" },
    { name: "section-header-variants", title: "Variants" },
  ],
  keyboard: null,
}
