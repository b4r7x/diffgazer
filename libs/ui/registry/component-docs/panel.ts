import type { ComponentDoc } from "./types"

export const panelDoc: ComponentDoc = {
  description:
    "Card-like container with composable header, content, and footer primitives.",
  anatomy: [
    { name: "Panel", indent: 0, note: "Root container with variant support (default bordered, borderless) and as prop (div, article, section, aside)" },
    { name: "PanelHeader", indent: 1, note: "Flex header bar with 3 style variants (default, terminal, subtle). Compose children directly for key-value layouts." },
    { name: "PanelContent", indent: 1, note: "Padded content area with configurable spacing" },
    { name: "PanelFooter", indent: 1, note: "Bottom metadata/action row with top border and muted background" },
  ],
  notes: [
    {
      title: "Semantic HTML",
      content:
        'Panel accepts as prop to render as article, section, or aside instead of div. For accessible card-like regions, use as="article" with aria-labelledby pointing to the header.',
    },
    {
      title: "Header Variants",
      content:
        "PanelHeader supports 3 variants: default (card-like with border and background), terminal (compact uppercase bar), and subtle (light centered text).",
    },
    {
      title: "Header with Value",
      content:
        "PanelHeader uses flex layout by default. Place children directly for key-value headers: wrap the label and value in separate elements and they will be spaced with justify-between.",
    },
    {
      title: "Footer",
      content:
        "PanelFooter provides a consistent trailing section for metadata or actions while preserving the same panel visual language.",
    },
  ],
  usage: { example: "panel-default" },
  examples: [
    { name: "panel-default", title: "Default" },
    { name: "panel-headers", title: "Headers" },
    { name: "panel-composed", title: "Composed" },
  ],
  keyboard: null,
  props: {
    Panel: {
      as: {
        type: '"div" | "article" | "section" | "aside"',
        required: false,
        defaultValue: '"div"',
        description: "Rendered HTML element. Use semantic elements for accessible regions.",
      },
      variant: {
        type: '"default" | "borderless"',
        required: false,
        defaultValue: '"default"',
        description: "Visual treatment. Default applies a border and elevated shadow.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Panel subparts.",
      },
    },
    PanelHeader: {
      variant: {
        type: '"default" | "terminal" | "subtle"',
        required: false,
        defaultValue: '"default"',
        description: "Header style. Terminal is a compact uppercase bar; subtle is small centered muted text.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Header content. Use two children to render a label and a value separated by space-between.",
      },
    },
    PanelContent: {
      spacing: {
        type: '"none" | "sm" | "md"',
        required: false,
        defaultValue: '"md"',
        description: "Vertical gap applied between direct children inside the content area.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Body content.",
      },
    },
    PanelFooter: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Footer metadata or actions.",
      },
    },
    PanelLegend: {
      tone: {
        type: '"default" | "muted" | "info" | "success" | "warning" | "error" | "accent"',
        required: false,
        defaultValue: '"muted"',
        description: "Color token applied to the floating legend label.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Legend text.",
      },
    },
  },
}
