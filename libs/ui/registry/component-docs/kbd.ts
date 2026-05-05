import type { ComponentDoc } from "./types"

export const kbdDoc: ComponentDoc = {
  description:
    "Keyboard key indicator rendered as an inline kbd element with terminal styling.",
  notes: [
    {
      title: "Size Variants",
      content: "Available in sm and md sizes (defaults to md). Renders inline, designed for use inside text.",
    },
    {
      title: "Terminal Styling",
      content: "Rendered with a border and bg-secondary background for a terminal key-cap appearance.",
    },
  ],
  usage: { example: "kbd-default" },
  examples: [
    { name: "kbd-default", title: "Default" },
    { name: "kbd-sizes", title: "Sizes" },
    { name: "kbd-inline", title: "Inline" },
    { name: "kbd-group", title: "Group" },
  ],
  keyboard: null,
}
