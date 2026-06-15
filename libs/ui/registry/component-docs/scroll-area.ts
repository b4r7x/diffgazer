import type { ComponentDoc } from "./types";

export const scrollAreaDoc: ComponentDoc = {
  description: "Thin-scrollbar wrapper with vertical, horizontal, or both overflow directions.",
  notes: [
    {
      title: "Orientation",
      content:
        "3 modes via orientation prop — vertical (default), horizontal, or both. Uses scrollbar-thin Tailwind utility.",
    },
    {
      title: "Wrapper Only",
      content:
        "ScrollArea is a pure wrapper that adds thin scrollbar styling. It renders no visual output of its own.",
    },
  ],
  usage: { example: "scroll-area-default" },
  examples: [
    { name: "scroll-area-default", title: "Default" },
    { name: "scroll-area-horizontal", title: "Horizontal" },
    { name: "scroll-area-both", title: "Both Directions" },
  ],
  keyboard: {
    description:
      'When keyboardScrollable is true and the region has aria-label or aria-labelledby, ScrollArea exposes role="region", becomes focusable, and scrolls itself from keyboard events.',
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
      { name: "scroll-area-default", title: "Vertical" },
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
      keyboardScrollable: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          'When true and the region has an accessible name (aria-label or aria-labelledby), wires Arrow/PageUp/PageDown/Home/End to scroll the container and applies role="region" with tabIndex={0}.',
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
