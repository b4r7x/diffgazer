import type { ComponentDoc } from "./types"

export const commandPaletteDoc: ComponentDoc = {
  description: "Terminal-styled command palette with built-in search filtering, grouped items, and keyboard navigation. Uses native dialog element with backdrop blur.",
  notes: [
    {
      title: "Controlled Open State",
      content: "CommandPalette is opened from outside via open/onOpenChange. Wire a trigger button (or a global keyboard shortcut) to setOpen(true). Search and highlight state can also be controlled via search/onSearchChange and highlighted/onHighlightChange, or left uncontrolled.",
    },
    {
      title: "Built-in Filtering",
      content: "Items are filtered automatically as you type. Each item matches against its `value` prop (falls back to `id`). Pass `shouldFilter={false}` to disable and handle filtering yourself. Pass a custom `filter` function to override the default case-insensitive includes match.",
    },
    {
      title: "Composition Contract",
      content: "Use CommandPalette.Item as an explicit child in the CommandPalette JSX tree, usually inside CommandPalette.List or CommandPalette.Group. Custom item UI belongs inside CommandPalette.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Built-in Keyboard Navigation",
      content: "CommandPalette integrates @diffgazer/keys's useNavigation internally for arrow-key navigation, wrapping, and Enter activation. Highlight and search state can be controlled externally via highlighted/onHighlightChange and search/onSearchChange.",
    },
  ],
  anatomy: [
    { name: "CommandPalette", indent: 0, note: "Root (manages open state, search, highlighted item, filtering)" },
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
    description: "Arrow keys navigate items (with wrapping), Enter activates the highlighted item. Escape clears search first, then closes the palette. Navigation is handled internally via @diffgazer/keys's useNavigation hook.",
    examples: [
      { name: "command-palette-demo", title: "Keyboard navigation" },
    ],
  },
  props: {
    CommandPalette: {
      open: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Controlled open state. Required to actually show the palette — wire a trigger button or shortcut to setOpen(true).",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Called whenever open state changes.",
      },
      search: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Controlled search query.",
      },
      onSearchChange: {
        type: "(value: string) => void",
        required: false,
        defaultValue: null,
        description: "Called when the search query changes.",
      },
      highlighted: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: "Controlled highlighted item id.",
      },
      onHighlightChange: {
        type: "(id: string | null) => void",
        required: false,
        defaultValue: null,
        description: "Called when the highlighted item changes.",
      },
      onActivate: {
        type: "(id: string) => void",
        required: false,
        defaultValue: null,
        description: "Called when an item is activated (Enter or click). Fires after the item's own onSelect.",
      },
      shouldFilter: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Auto-filter items by search. Pass false to handle filtering yourself (e.g. server-side).",
      },
      filter: {
        type: "(value: string, search: string) => boolean",
        required: false,
        defaultValue: null,
        description: "Custom filter function. Defaults to case-insensitive substring match on the item's value (or id).",
      },
    },
    CommandPaletteItem: {
      id: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable unique id used for highlight state and aria-activedescendant.",
      },
      value: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Searchable text. Defaults to id when omitted.",
      },
      shortcut: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Keyboard shortcut hint rendered next to the label.",
      },
      onSelect: {
        type: "() => void",
        required: false,
        defaultValue: null,
        description: "Called when the item is activated. Runs before CommandPalette.onActivate.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disable activation and skip in keyboard navigation.",
      },
    },
    CommandPaletteGroup: {
      heading: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Group heading rendered above the items.",
      },
    },
    CommandPaletteInput: {
      placeholder: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Search input placeholder.",
      },
    },
  },
}
