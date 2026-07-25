import type { ComponentDoc } from "./types";

export const spinnerDoc: ComponentDoc = {
  description:
    "Terminal-inspired TUI spinner with four animation styles. The default snake variant renders a 3×3 pixel grid with a trailing dot that moves clockwise — like a pixelated snake.",
  anatomy: [
    {
      name: "Spinner",
      indent: 0,
      note: "Root element — renders the animation glyph. Accepts variant, size, labelPosition, gap, and speed props. Pass children for a label.",
    },
  ],
  notes: [
    {
      title: "Labels",
      content:
        "Pass children to Spinner to render a label. The labelPosition prop controls where the label appears relative to the glyph: right (default), left, top, or bottom.",
    },
    {
      title: "Gap Control",
      content:
        'The gap prop controls the space between the spinner glyph and its label. Values: "none" (0), "sm" (4px), "md" (8px, default), "lg" (12px). Works for both horizontal and vertical label positions.',
    },
    {
      title: "Fixed Glyph Box",
      content:
        "All four variants animate inside one 2em-square box that scales with the size prop, so swapping variant or cycling frames never moves the label or reflows the row. 2em is the largest footprint any variant needs — the lg snake grid measures 32px at its 16px font size, and the widest dots frame reserves 3ch.",
    },
    {
      title: "Snake Variant",
      content:
        "A 3×3 grid of dots with a 3-dot trail moving clockwise around the 8-position perimeter. The head, body, tail, and idle alphas come from the --spinner-trail-* variables in spinner.css; the light palette raises the ramp (idle 32% instead of 15%) so the trail stays legible on a light background.",
    },
    {
      title: "Reduced Motion",
      content:
        "When prefers-reduced-motion is active, the animation stops at the first frame. If the preference changes at runtime, the animation responds accordingly.",
    },
    {
      title: "Speed Override",
      content:
        "The speed prop overrides the default frame interval in milliseconds. Default speeds: snake 100ms, braille 80ms, dots 300ms, pulse 80ms.",
    },
  ],
  usage: { example: "spinner-default" },
  examples: [
    { name: "spinner-default", title: "Default" },
    { name: "spinner-variants", title: "Variants" },
    { name: "spinner-sizes", title: "Sizes" },
    { name: "spinner-label-positions", title: "Label Positions" },
    { name: "spinner-gap-and-speed", title: "Gap and Speed" },
  ],
  keyboard: null,
  cssVariables: [
    {
      name: "--spinner-trail-head",
      description: "Opacity of the snake head dot.",
      defaultValue: "1",
    },
    {
      name: "--spinner-trail-body",
      description: "Opacity of the dot one step behind the head.",
      defaultValue: "0.6 (light: 0.7)",
    },
    {
      name: "--spinner-trail-tail",
      description: "Opacity of the dot two steps behind the head.",
      defaultValue: "0.3 (light: 0.45)",
    },
    {
      name: "--spinner-trail-idle",
      description: "Opacity of the perimeter dots the trail has passed.",
      defaultValue: "0.15 (light: 0.32)",
    },
  ],
  props: {
    Spinner: {
      variant: {
        type: '"snake" | "braille" | "dots" | "pulse"',
        required: false,
        defaultValue: '"snake"',
        description:
          "Animation style. Snake renders a 3x3 pixel grid; braille, dots, and pulse render text glyph sequences.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Font size token applied to the glyph and label.",
      },
      labelPosition: {
        type: '"right" | "left" | "top" | "bottom"',
        required: false,
        defaultValue: '"right"',
        description: "Placement of the children label relative to the spinner glyph.",
      },
      gap: {
        type: '"none" | "sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Space between the spinner glyph and its label.",
      },
      speed: {
        type: "number",
        required: false,
        defaultValue: null,
        description:
          "Frame interval in milliseconds. Overrides the variant default (snake 100, braille 80, dots 300, pulse 80).",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: 'Optional label. When omitted, the spinner uses aria-label="Loading".',
      },
    },
  },
};
