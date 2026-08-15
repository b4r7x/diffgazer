import type { ComponentDoc } from "./types.js";

export const sectionHeaderDoc: ComponentDoc = {
  description:
    "Uppercase heading element for labeling content sections, with configurable heading level and variant.",
  notes: [
    {
      title: "Variant",
      content:
        "The variant prop controls visual intensity. Default uses foreground color, muted uses muted-foreground, and accent uses the theme accent for a highlighted section label.",
    },
    {
      title: "Heading Level",
      content:
        "The as prop renders as h2, h3, or h4 (defaults to h3). Each level carries its own size, weight, and letter-spacing so the three read as a scale: h2 is the largest and tightest, h4 the smallest and widest-tracked.",
    },
    {
      title: "Spacing",
      content:
        "SectionHeader owns no outside margin. The layout that places the header decides the gap below it (for example mb-2 next to body copy, or a flex gap in a stacked panel).",
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
        type: '"default" | "muted" | "accent"',
        required: false,
        defaultValue: '"default"',
        description:
          "Color intensity. Default uses foreground, muted uses muted-foreground, accent uses the theme accent.",
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
};
