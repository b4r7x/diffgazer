import type { ComponentDoc } from "./types"

export const dividerDoc: ComponentDoc = {
  description:
    "Line separator with horizontal and vertical orientation, default and spaced variants.",
  notes: [
    {
      title: "Spaced Variant",
      content:
        "The spaced variant renders a centered label between two rules with margin. Pass children to customize the label; defaults to \u2726 when no children are provided. The default variant is a simple line.",
    },
    {
      title: "Vertical Orientation",
      content:
        'Set orientation="vertical" to render a vertical separator. Works with both default and spaced variants. The parent must define a height for the divider to fill.',
    },
    {
      title: "Decorative vs Semantic",
      content:
        'By default, decorative is true — the divider renders with role="none" so screen readers skip it. Most dividers are visual rhythm, not meaningful content boundaries. Set decorative={false} when the separator marks a real structural boundary between distinct page sections.',
    },
  ],
  usage: { example: "divider-default" },
  examples: [
    { name: "divider-default", title: "Default" },
    { name: "divider-variants", title: "Variants" },
    { name: "divider-custom-label", title: "Custom Label" },
    { name: "divider-vertical", title: "Vertical" },
    { name: "divider-decorative", title: "Semantic (non-decorative)" },
  ],
  keyboard: null,
}
