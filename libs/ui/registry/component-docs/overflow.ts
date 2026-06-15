import type { ComponentDoc } from "./types";

export const overflowDoc: ComponentDoc = {
  description:
    "Container-aware overflow handling for items (dynamic fitting with indicator) and text (line clamping with auto-tooltip when truncated).",
  anatomy: [
    {
      name: "Overflow",
      indent: 0,
      note: 'Root — text mode by default; set mode="items" for fitting child items',
    },
  ],
  notes: [
    {
      title: "Two Modes",
      content:
        'Text mode is the default: CSS truncation with useOverflowDetection hook detecting actual overflow + Tooltip that only appears when content is truly clipped. Items mode requires mode="items" and measures children against container width via ResizeObserver, showing what fits plus an overflow indicator.',
    },
    {
      title: "Items Mode",
      content:
        "Uses a hidden measurement row to calculate widths before paint (no flicker). Default indicator is an ellipsis badge. Customize via the indicator prop — pass a render function ({ count }) => ReactNode or static ReactNode.",
    },
    {
      title: "Text Mode",
      content:
        "Set lines={1} for single-line truncate or lines={2+} for multi-line clamping. Tooltip auto-derives content from string children. Set tooltip={false} to disable, or tooltip={<custom>} for custom content.",
    },
    {
      title: "useOverflowDetection Hook",
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
  props: {
    Overflow: {
      mode: {
        type: '"text" | "items"',
        required: false,
        defaultValue: '"text"',
        description:
          "Text clamps string content with optional auto-tooltip; items measures children and renders an overflow indicator for those that do not fit.",
      },
      children: {
        type: "string (text mode) | ReactNode (items mode)",
        required: true,
        defaultValue: null,
        description: "String to clamp (text mode) or items to measure (items mode).",
      },
      lines: {
        type: "number",
        required: false,
        defaultValue: "1",
        description: "Text mode only. 1 truncates; 2+ uses CSS line-clamp.",
      },
      tooltip: {
        type: "ReactNode | boolean",
        required: false,
        defaultValue: null,
        description:
          "Text mode only. true/ReactNode renders a Tooltip when content is actually clipped (auto-derived from children when true). false disables the tooltip.",
      },
      gap: {
        type: "string",
        required: false,
        defaultValue: '"gap-1"',
        description: "Items mode only. Tailwind gap class applied between items and indicator.",
      },
      indicator: {
        type: "ReactNode | ((props: { count: number }) => ReactNode)",
        required: false,
        defaultValue: "dashed ellipsis badge",
        description: "Items mode only. Render function or static node shown when items overflow.",
      },
    },
  },
};
