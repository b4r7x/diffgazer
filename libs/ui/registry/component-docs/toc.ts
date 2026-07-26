import type { ComponentDoc } from "./types";

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
      title: "Current-location mark",
      content:
        'The library spells "you are here" one way: a 2px left rail in --primary (registry/lib/marker-rail.ts). Full-bleed inversion is reserved for the TRANSIENT keyboard highlight; a row that is both the current location and the highlight keeps the inversion and flips its rail to --primary-foreground so the mark survives. The rail is reserved transparently in the resting state and pulled back by its own width, so a row\'s label never shifts horizontally when it becomes current \u2014 that anti-shift geometry is the contract, and it is why the rail costs 0px of label width at 375/390 where a full-bleed fill reads as a solid slab. Toc is the reference implementation of that rail.',
    },
    {
      title: "Headless-friendly",
      content:
        "Toc/TocList/TocItem are presentation primitives. Pair them with your own heading tracking logic (e.g. IntersectionObserver or Fumadocs AnchorProvider).",
    },
    {
      title: "Depth",
      content: "Use the depth prop on TocItem to indent nested headings consistently (h2/h3/h4).",
    },
    {
      title: "Page Layout",
      content:
        "Toc renders the nav landmark and its heading only. Width, sticky offset, and page padding are call-site decisions — pass them via className (the docs site uses w-56 shrink-0 py-8 pr-4).",
    },
    {
      title: "Active Marker",
      content:
        "An active TocItem bolds its label and paints a 2px rail segment over the TocList hairline, matching the sidebar bar/terminal marker language.",
    },
  ],
  usage: { example: "toc-default" },
  examples: [
    { name: "toc-default", title: "Default" },
    { name: "toc-depth", title: "Nested Depth (h2/h3/h4) + Active State" },
    { name: "toc-active", title: "Active Heading Tracking (scroll container)" },
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
        description:
          "Heading depth (2 = h2). Drives left padding; values below 2 are treated as 2.",
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          'Marks the link as the current location. Adds aria-current="location" and data-selected.',
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
};
