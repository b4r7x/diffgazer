import type { ComponentDoc } from "./types"

export const commandPaletteDoc: ComponentDoc = {
  description: "Terminal-styled command palette with built-in search filtering, grouped items, and keyboard navigation. Uses native dialog element with backdrop blur.",
  notes: [
    {
      title: "Controlled & Uncontrolled",
      content: "CommandPalette supports both controlled (open/onOpenChange) and uncontrolled usage. In uncontrolled mode it manages its own open state internally.",
    },
    {
      title: "Built-in Filtering",
      content: "Items are filtered automatically as you type. Each item matches against its `value` prop (falls back to `id`). Pass `shouldFilter={false}` to disable and handle filtering yourself. Pass a custom `filter` function to override the default case-insensitive includes match.",
    },
    {
      title: "Item Registration",
      content: "Items register themselves via context on mount. Disabled and filtered-out items are excluded from keyboard navigation. The selected item auto-scrolls into view.",
    },
    {
      title: "Built-in Keyboard Navigation",
      content: "CommandPalette integrates @diffgazer/keys's useNavigation internally for arrow-key navigation, wrapping, and Enter activation. Selection and search state can still be controlled externally via selectedId/onSelectedIdChange.",
    },
  ],
  anatomy: [
    { name: "CommandPalette", indent: 0, note: "Root (manages open state, search, selection, filtering)" },
    { name: "CommandPaletteContent", indent: 1, note: "Native dialog modal container" },
    { name: "CommandPaletteInput", indent: 2, note: "Search input with prefix/suffix slots" },
    { name: "CommandPaletteList", indent: 2, note: "Scrollable item container" },
    { name: "CommandPaletteEmpty", indent: 3, note: "Shown when no items match search" },
    { name: "CommandPaletteGroup", indent: 3, note: "Labeled group of items" },
    { name: "CommandPaletteItem", indent: 4, note: "Selectable item with icon, shortcut, value" },
    { name: "CommandPaletteFooter", indent: 2, note: "Hint bar / status area" },
  ],
  usage: { example: "command-palette-demo" },
  examples: [
    { name: "command-palette-demo", title: "Default" },
  ],
  keyboard: {
    description: "Arrow keys navigate items (with wrapping), Enter activates the selected item. Escape clears search first, then closes the palette. Navigation is handled internally via @diffgazer/keys's useNavigation hook.",
    examples: [
      { name: "command-palette-demo", title: "Keyboard navigation" },
    ],
  },
}
