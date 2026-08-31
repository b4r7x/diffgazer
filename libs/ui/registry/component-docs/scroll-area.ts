import type { ComponentDoc } from "./types.js";

export const scrollAreaDoc: ComponentDoc = {
  description: "Thin-scrollbar wrapper with vertical, horizontal, or both overflow directions.",
  notes: [
    {
      title: "Orientation",
      content:
        "3 modes via orientation prop — vertical (default), horizontal, or both. The thin bar comes from the library's own unlayered .scrollbar-thin utility, which deliberately outranks Tailwind v4's same-named built-in. The overlay prop applies to the vertical mode only.",
    },
    {
      title: "Wrapper Only",
      content:
        "Without overlay, ScrollArea is a pure wrapper that adds thin scrollbar styling and renders no visual output of its own. With overlay it renders one zero-height rail as the container's first DOM child (ahead of children) carrying the floating thumb — account for it in position-keyed styling of direct children (first:, nth-child, space-y-*).",
    },
    {
      title: "Resting Thumb",
      content:
        "The thumb is visible at rest (foreground at 35%) and strengthens on hover or focus-within, so overflow is signalled before the pointer arrives. Chromium and WebKit get that resting thumb from the ::-webkit-scrollbar tree, and the standard scrollbar-width/scrollbar-color pair is confined to engines without that pseudo-element: declaring both on one element makes Chromium fall back to a platform overlay scrollbar that stays invisible until you scroll. Override --scrollbar-thumb and --scrollbar-thumb-active on the ScrollArea or any ancestor to retune both steps — the overlay mode's floating thumb consumes the same two tokens, so one retune moves both presentations. Give the scroll container at least 1px of inset from a surrounding border so the track and the border do not read as one doubled edge.",
    },
  ],
  usage: { example: "scroll-area-default" },
  examples: [
    { name: "scroll-area-default", title: "Default" },
    { name: "scroll-area-horizontal", title: "Horizontal" },
    { name: "scroll-area-both", title: "Both Directions" },
    { name: "scroll-area-keyboard", title: "Keyboard Region" },
    { name: "scroll-area-overlay", title: "Overlay" },
  ],
  keyboard: {
    description:
      'ScrollArea exposes role="region" whenever it has an accessible name (aria-label or aria-labelledby). When keyboardScrollable is also true, the named region becomes focusable and scrolls itself from keyboard events.',
    keys: [
      {
        keys: "ArrowUp / ArrowDown",
        action: "Scrolls vertical or both-axis regions by 40px.",
      },
      {
        keys: "ArrowLeft / ArrowRight",
        action: "Scrolls horizontal or both-axis regions by 40px.",
      },
      {
        keys: "PageUp / PageDown",
        action:
          "Scrolls vertical regions by 80% of height; horizontal-only regions scroll by 80% of width.",
      },
      {
        keys: "Home / End",
        action: "Moves to the start or end of each enabled scroll axis.",
      },
    ],
    examples: [
      { name: "scroll-area-keyboard", title: "Focusable region" },
      { name: "scroll-area-both", title: "Both directions" },
    ],
  },
  props: {
    ScrollArea: {
      orientation: {
        type: '"vertical" | "horizontal" | "both"',
        required: false,
        defaultValue: '"vertical"',
        description: "Axes that overflow. Other axes are clipped.",
      },
      overlay: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Hides the native scrollbar and floats a draggable thumb above the content, so rows can run border-to-border instead of stopping at a reserved track. Applies only with the vertical orientation — other orientations keep their native bar — and only on hover-capable devices; touch keeps the native indicator. Renders a zero-height rail as the container's first DOM child, ahead of children. The thumb hides when content fits, and it follows the same --scrollbar-thumb / --scrollbar-thumb-active tokens as the thin scrollbar.",
      },
      keyboardScrollable: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          'When true and the region has an accessible name (aria-label or aria-labelledby), wires Arrow/PageUp/PageDown/Home/End to scroll the container and gives it tabIndex={0}. role="region" follows the accessible name alone, so a named region keeps its role when this is false — hand key handling to a parent composite only when that parent also owns the tab stop.',
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Content rendered inside the scrollable container.",
      },
    },
  },
};
