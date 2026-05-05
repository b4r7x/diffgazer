import type { ComponentDoc } from "./types"

export const overflowDoc: ComponentDoc = {
  description:
    "Container-aware overflow handling for items (dynamic fitting with indicator) and text (line clamping with auto-tooltip when truncated).",
  anatomy: [
    { name: "Overflow", indent: 0, note: "Root — items mode (default) or text mode (with lines prop)" },
  ],
  notes: [
    {
      title: "Two Modes",
      content:
        "Items mode (default): measures children against container width via ResizeObserver, shows what fits plus an overflow indicator. Text mode (lines prop): CSS truncation with useOverflow hook detecting actual overflow + Tooltip that only appears when content is truly clipped.",
    },
    {
      title: "Items Mode",
      content:
        'Uses a hidden measurement row to calculate widths before paint (no flicker). Default indicator is an ellipsis badge. Customize via the indicator prop — pass a render function ({ count }) => ReactNode or static ReactNode.',
    },
    {
      title: "Text Mode",
      content:
        "Set lines={1} for single-line truncate or lines={2+} for multi-line clamping. Tooltip auto-derives content from string children. Set tooltip={false} to disable, or tooltip={<custom>} for custom content.",
    },
    {
      title: "useOverflow Hook",
      content:
        "The overflow detection logic is available as a standalone hook (overflow-detection registry item). Use it independently for custom overflow UIs.",
    },
  ],
  usage: { example: "overflow-items" },
  examples: [
    { name: "overflow-items", title: "Items" },
    { name: "overflow-avatars", title: "Avatars" },
    { name: "overflow-text", title: "Text" },
  ],
  keyboard: null,
}
