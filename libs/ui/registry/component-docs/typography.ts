import type { ComponentDoc } from "./types";

export const typographyDoc: ComponentDoc = {
  description:
    "Terminal-styled typography wrapper for consistent text styling. Provides variants for body text, prose content, and compact displays, plus semantic h1-h6 headings with sensible default sizing.",
  notes: [
    {
      title: "Variants",
      content:
        "Use 'default' for general UI text, 'prose' for longer-form content with wider line-height, and 'compact' for dense secondary information.",
    },
    {
      title: "Semantic Elements",
      content:
        "Use the 'as' prop to render the appropriate HTML element: 'p' for paragraphs, 'span' for inline text, 'div' for block content, and 'h1'-'h6' for semantic headings. Defaults to 'div'.",
    },
    {
      title: "Heading Defaults",
      content:
        "Each heading level has a default size (h1 = 3xl, h2 = 2xl, h3 = xl, h4 = lg, h5 = base, h6 = sm) and auto-defaults to bold weight. Pass explicit 'size' or 'weight' props to override.",
    },
  ],
  usage: { example: "typography-default" },
  examples: [{ name: "typography-default", title: "Default" }],
  keyboard: null,
  props: {
    Typography: {
      as: {
        type: '"div" | "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"',
        required: false,
        defaultValue: '"div"',
        description: "Rendered HTML element. Use h1-h6 for semantic headings.",
      },
      variant: {
        type: '"default" | "prose" | "compact"',
        required: false,
        defaultValue: '"default"',
        description:
          "Line-height token. Default for UI text, prose for long-form, compact for dense info.",
      },
      size: {
        type: '"xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl"',
        required: false,
        defaultValue: '"sm" (for non-headings); h1=3xl, h2=2xl, h3=xl, h4=lg, h5=base, h6=sm',
        description: "Font-size token. Explicit value overrides the heading default.",
      },
      weight: {
        type: '"normal" | "medium" | "semibold" | "bold"',
        required: false,
        defaultValue: '"normal" (for non-headings); h1-h6 auto-default to "bold"',
        description: "Font-weight token. Explicit value overrides the heading default.",
      },
      color: {
        type: '"default" | "muted" | "accent"',
        required: false,
        defaultValue: '"default"',
        description:
          "Text color token. default uses the primary text color, muted uses muted-foreground, accent uses the theme primary.",
      },
      lineClamp: {
        type: "1 | 2 | 3 | 4 | 5 | 6",
        required: false,
        defaultValue: null,
        description: "Truncates after the given number of lines with an ellipsis.",
      },
      truncate: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Single-line truncation with ellipsis.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Text content.",
      },
    },
  },
};
