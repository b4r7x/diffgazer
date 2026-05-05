import type { ComponentDoc } from "./types"

export const scrollAreaDoc: ComponentDoc = {
  description:
    "Thin-scrollbar wrapper with vertical, horizontal, or both overflow directions.",
  notes: [
    {
      title: "Orientation",
      content: "3 modes via orientation prop — vertical (default), horizontal, or both. Uses scrollbar-thin Tailwind utility.",
    },
    {
      title: "Wrapper Only",
      content: "ScrollArea is a pure wrapper that adds thin scrollbar styling. It renders no visual output of its own.",
    },
  ],
  usage: { example: "scroll-area-default" },
  examples: [
    { name: "scroll-area-default", title: "Default" },
    { name: "scroll-area-horizontal", title: "Horizontal" },
    { name: "scroll-area-both", title: "Both Directions" },
  ],
  keyboard: null,
}
