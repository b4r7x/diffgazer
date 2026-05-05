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
}
