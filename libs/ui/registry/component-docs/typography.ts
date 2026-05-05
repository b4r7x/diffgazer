import type { ComponentDoc } from "./types"

export const typographyDoc: ComponentDoc = {
  description:
    "Terminal-styled typography wrapper for consistent text styling. Provides variants for body text, prose content, and compact displays.",
  notes: [
    {
      title: "Variants",
      content:
        "Use 'default' for general UI text, 'prose' for longer-form content with wider line-height, and 'compact' for dense secondary information.",
    },
    {
      title: "Semantic Elements",
      content:
        "Use the 'as' prop to render the appropriate HTML element: 'p' for paragraphs, 'span' for inline text, 'div' for block content. Defaults to 'div'.",
    },
  ],
  usage: { example: "typography-default" },
  examples: [
    { name: "typography-default", title: "Default" },
  ],
  keyboard: null,
}
