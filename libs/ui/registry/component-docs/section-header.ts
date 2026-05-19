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
      content: "The as prop renders as h2, h3, or h4 (defaults to h3). H2 reads largest, h3 is the default size, h4 reads smallest — all sharing the same uppercase tracking-wider styling.",
    },
  ],
  usage: { example: "section-header-default" },
  examples: [
    { name: "section-header-default", title: "Default" },
    { name: "section-header-variants", title: "Variants" },
  ],
  keyboard: null,
  props: {
    SectionHeader: {
      as: {
        type: '"h2" | "h3" | "h4"',
        required: false,
        defaultValue: '"h3"',
        description: "Heading level. Choose the level that matches your document outline.",
      },
      variant: {
        type: '"default" | "muted"',
        required: false,
        defaultValue: '"default"',
        description: "Color intensity. Default uses foreground; muted uses muted-foreground.",
      },
      bordered: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Adds a bottom border under the heading.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Heading text.",
      },
    },
  },
}
