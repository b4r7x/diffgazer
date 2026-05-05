import type { ComponentDoc } from "./types"

export const menuDoc: ComponentDoc = {
  description: "Terminal-styled selection list with keyboard navigation, highlighting and optional hotkey indicators.",
  anatomy: [
    { name: "Menu", indent: 0, note: "Root (manages selection, variant context)" },
    { name: "MenuItem", indent: 1, note: "Selectable item with optional hotkey, value, variant" },
    { name: "MenuDivider", indent: 1, note: "Visual separator between groups" },
  ],
  notes: [
    {
      title: "Built-in Keyboard Navigation",
      content: "Menu includes keyboard navigation via useListbox (Arrow keys, Home/End, Enter/Space). For custom key bindings or cross-component navigation, use the highlighted, onHighlightChange, and onKeyDown props to add external handlers alongside the built-in behavior.",
    },
  ],
  usage: { example: "menu-default" },
  examples: [
    { name: "menu-default", title: "Default" },
    { name: "menu-nested", title: "Hub Variant" },
  ],
  keyboard: {
    description: "Keyboard navigation is built-in. The menu-keyboard example demonstrates controlled mode with explicit state management. Arrow keys move focus, Enter activates selection.",
    examples: [
      { name: "menu-keyboard", title: "Controlled keyboard navigation" },
    ],
  },
}
