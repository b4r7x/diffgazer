import type { ComponentDoc } from "./types"

export const tocDoc: ComponentDoc = {
  description:
    "Table of contents primitives for rendering section links with depth indentation and active states.",
  anatomy: [
    { name: "Toc", indent: 0, note: "Root aside wrapper and optional heading label" },
    { name: "TocList", indent: 1, note: "List container for TOC items" },
    { name: "TocItem", indent: 2, note: "Individual TOC entry with depth/active styling" },
  ],
  notes: [
    {
      title: "Headless-friendly",
      content:
        "Toc/TocList/TocItem are presentation primitives. Pair them with your own heading tracking logic (e.g. IntersectionObserver or Fumadocs AnchorProvider).",
    },
    {
      title: "Depth",
      content:
        "Use the depth prop on TocItem to indent nested headings consistently (h2/h3/h4).",
    },
  ],
  usage: { example: "toc-default" },
  examples: [
    { name: "toc-default", title: "Default" },
    { name: "toc-depth", title: "Nested Depth + Active State" },
    { name: "toc-active", title: "With Active Heading Tracking" },
  ],
  keyboard: null,
  props: {
    Toc: {
      title: {
        type: "string",
        required: false,
        defaultValue: '"On this page"',
        description: "Heading text and accessible label for the nav landmark.",
      },
      as: {
        type: '"h2" | "h3" | "h4"',
        required: false,
        defaultValue: '"h2"',
        description: "Heading level used for the title.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Typically a TocList with TocItem children.",
      },
    },
    TocList: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "TocItem children rendered inside a <ul>.",
      },
    },
    TocItem: {
      depth: {
        type: "number",
        required: false,
        defaultValue: "2",
        description: "Heading depth (2 = h2). Drives left padding; values below 2 are treated as 2.",
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: 'Marks the link as the current location. Adds aria-current="location" and data-active.',
      },
      href: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Anchor href. Omit when rendering via the render-prop form.",
      },
      children: {
        type: "ReactNode | (props: TocItemRenderProps) => ReactNode",
        required: true,
        defaultValue: null,
        description: "Link label, or a render function for framework Link integration.",
      },
    },
  },
}
