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
        "Pass a segments array: segments={[{ value: 60, variant: 'success' }, { value: 25, variant: 'warning' }]}. Value is derived from the segment sum unless explicitly provided. When segments and children are both provided, segments win and define rendering and value.",
    },
    {
      title: "Compound Mode",
      content:
        "Pass BlockBar.Segment children for custom per-segment content (labels, event handlers, tooltips). Root renders the empty background automatically.",
    },
    {
      title: "Value Text",
      content:
        "Set valueText to customize aria-valuetext for app-owned labels such as severity summaries. The visible value remains numeric.",
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
  props: {
    BlockBar: {
      value: {
        type: "number",
        required: false,
        defaultValue: null,
        description: "Current value. Required unless segments are provided or BlockBar.Segment children are passed (in which case the value is derived from their sum).",
      },
      max: {
        type: "number",
        required: true,
        defaultValue: null,
        description: "Maximum value the bar represents. Used for aria-valuemax and fill ratio.",
      },
      barWidth: {
        type: "number",
        required: false,
        defaultValue: "20",
        description: "Width of the bar in character cells. Clamped to 0-200.",
      },
      filledChar: {
        type: "string",
        required: false,
        defaultValue: '"█"',
        description: "Character used for the filled portion of the bar.",
      },
      emptyChar: {
        type: "string",
        required: false,
        defaultValue: '"░"',
        description: "Character used for the empty portion of the bar.",
      },
      label: {
        type: "string",
        required: false,
        defaultValue: null,
        description: 'Visible label rendered to the left of the bar in simple mode. Also used as accessible name when aria-label is omitted.',
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: null,
        description: 'Accessible name. When set (or label is set), the bar exposes role="meter" with aria-valuemin/max/now/text.',
      },
      "aria-labelledby": {
        type: "string",
        required: false,
        defaultValue: null,
        description: "ID of an element labelling the bar. Alternative to aria-label.",
      },
      valueText: {
        type: "string",
        required: false,
        defaultValue: '"{value} of {max}"',
        description: "Override for aria-valuetext.",
      },
      variant: {
        type: '"default" | "muted" | "error" | "warning" | "success" | "info"',
        required: false,
        defaultValue: '"default"',
        description: "Color token applied to the implicit single segment when no segments or children are provided.",
      },
      segments: {
        type: "{ value: number; variant?: SegmentVariant; char?: string }[]",
        required: false,
        defaultValue: null,
        description: "Multi-segment stack. When provided, takes precedence over children and derives value from the sum.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "BlockBar.Segment children for fully custom rendering. Throws when neither value nor segments are provided and children are not BlockBar.Segment elements.",
      },
    },
    "BlockBar.Segment": {
      value: {
        type: "number",
        required: true,
        defaultValue: null,
        description: "Segment value in the same units as BlockBar max.",
      },
      variant: {
        type: '"default" | "muted" | "error" | "warning" | "success" | "info"',
        required: false,
        defaultValue: '"default"',
        description: "Segment color token.",
      },
      char: {
        type: "string",
        required: false,
        defaultValue: "BlockBar filledChar",
        description: "Override the filled character for this segment only.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Optional content rendered after the segment glyphs (e.g. a label or icon).",
      },
    },
  },
}
