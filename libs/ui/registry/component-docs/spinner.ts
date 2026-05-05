import type { ComponentDoc } from "./types"

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
      title: "Snake Variant",
      content:
        "A 3×3 grid of dots with a 3-dot trail moving clockwise around the 8-position perimeter. The head renders at full opacity, body at 60%, tail at 30%, and inactive dots at 15%.",
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
  ],
  keyboard: null,
}
