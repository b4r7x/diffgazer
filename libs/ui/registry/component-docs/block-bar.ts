import type { ComponentDoc } from "./types"

export const blockBarDoc: ComponentDoc = {
  description:
    "Unicode block-character bar for displaying proportional values. Supports single-value and multi-segment stacked bars.",
  anatomy: [
    { name: "BlockBar", indent: 0, note: "Root meter element with ARIA attributes" },
    { name: "BlockBar.Segment", indent: 1, note: "Customizable colored segment with optional children content" },
  ],
  notes: [
    {
      title: "Simple Mode",
      content:
        'Single-value bar: <BlockBar label="Errors" value={3} max={45} variant="error" />. Label, bar, and value display are rendered automatically.',
    },
    {
      title: "Multi-Segment Mode",
      content:
        "Pass a segments array: segments={[{ value: 60, variant: 'success' }, { value: 25, variant: 'warning' }]}. Value is derived from the segment sum unless explicitly provided.",
    },
    {
      title: "Compound Mode",
      content:
        "Pass BlockBar.Segment children for custom per-segment content (labels, event handlers, tooltips). Root renders the empty background automatically.",
    },
    {
      title: "Color Variants",
      content:
        "The variant prop accepts: default, muted, error, warning, success, info.",
    },
    {
      title: "Custom Characters",
      content:
        "filledChar (default: \u2588) and emptyChar (default: \u2591) control the block characters. Individual segments can override with the char prop.",
    },
  ],
  usage: { example: "block-bar-default" },
  examples: [
    { name: "block-bar-default", title: "Default" },
    { name: "block-bar-stats", title: "Stats" },
    { name: "block-bar-multi-segment", title: "Multi-Segment" },
  ],
  keyboard: null,
}
