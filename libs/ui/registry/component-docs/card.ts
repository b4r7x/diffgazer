import type { ComponentDoc } from "./types"

export const cardDoc: ComponentDoc = {
  description:
    "Simple bordered card primitives with floating border labels and semantic HTML support.",
  anatomy: [
    { name: "Card", indent: 0, note: "Main bordered card surface with variant, size, and as props" },
    { name: "CardLabel", indent: 1, note: "Floating border label with variant='border' or variant='gap'" },
    { name: "CardHeader", indent: 1, note: "Header region with grid layout and bottom border" },
    { name: "CardTitle", indent: 2, note: "Title text with configurable heading level (as prop)" },
    { name: "CardDescription", indent: 2, note: "Supporting description text" },
    { name: "CardAction", indent: 2, note: "Action slot in header (positioned top-right via grid)" },
    { name: "CardContent", indent: 1, note: "Body content region" },
    { name: "CardFooter", indent: 1, note: "Footer actions/meta region" },
  ],
  notes: [
    {
      title: "Variants",
      content:
        "Card is simple and bordered by default. Use variant='panel' to opt into an elevated panel-like treatment.",
    },
    {
      title: "Floating Border Labels",
      content:
        "Use CardLabel variant='border' for a boxed border label, or variant='gap' for a border cutout label with no border around the text. When using CardLabel, add pt-6 (or similar) to sibling CardContent to clear the floating label.",
    },
    {
      title: "Size",
      content:
        "Card supports size='sm' | 'md' | 'lg' for max-width constraints. Default is full width.",
    },
    {
      title: "Heading Level",
      content:
        "CardTitle renders an h3 by default. Use the as prop to change the heading level (h2, h3, h4, h5).",
    },
    {
      title: "Header Actions",
      content:
        "Use CardAction inside CardHeader to place an action (button, badge) in the top-right corner. The header switches to a two-column grid layout automatically when CardAction is present.",
    },
    {
      title: "Semantic HTML",
      content:
        "Card renders a div by default. Use as='article' for self-contained content, as='section' for grouped content, or as='aside' for tangential content.",
    },
    {
      title: "Accessible Article Cards",
      content:
        "When using as='article', connect the card to its heading with aria-labelledby so screen readers announce card boundaries. Give CardTitle an id and pass the same id to Card's aria-labelledby. See the Article example.",
    },
  ],
  usage: { example: "card-default" },
  examples: [
    { name: "card-default", title: "Default" },
    { name: "card-sizes", title: "Sizes" },
    { name: "card-action", title: "Header Action" },
    { name: "card-article", title: "Article (accessible)" },
  ],
  keyboard: null,
  props: {
    Card: {
      as: {
        type: '"div" | "article" | "section" | "aside"',
        required: false,
        defaultValue: '"div"',
        description: "Rendered HTML element. Use article/section/aside when the card is a self-contained content region.",
      },
      variant: {
        type: '"default" | "panel"',
        required: false,
        defaultValue: '"default"',
        description: "Visual treatment. Panel adds an elevated shadow.",
      },
      size: {
        type: '"default" | "sm" | "md" | "lg"',
        required: false,
        defaultValue: '"default"',
        description: "Max-width constraint. Default is full width.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Card subparts (Header, Label, Content, Footer, etc.).",
      },
    },
    "Card.Label": {
      variant: {
        type: '"border" | "gap"',
        required: false,
        defaultValue: '"border"',
        description: "Visual treatment of the floating label. Border boxes the label; gap omits the box.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Label content.",
      },
    },
    "Card.Title": {
      as: {
        type: '"h2" | "h3" | "h4" | "h5"',
        required: false,
        defaultValue: '"h3"',
        description: "Heading level. Match your document outline.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Title text.",
      },
    },
    "Card.Description": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Supporting description text.",
      },
    },
    "Card.Header": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Header content. When a Card.Action child is present, the header switches to a two-column grid.",
      },
    },
    "Card.Action": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Action element (button or badge) anchored to the top-right of Card.Header.",
      },
    },
    "Card.Content": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Body content.",
      },
    },
    "Card.Footer": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Footer actions or meta, right-aligned by default.",
      },
    },
  },
}
