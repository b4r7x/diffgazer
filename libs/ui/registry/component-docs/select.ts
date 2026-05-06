import type { ComponentDoc } from "./types"

export const selectDoc: ComponentDoc = {
  description:
    "Dropdown select with search, multiple selection, card variant, and headless keyboard integration points. 8 composable parts.",
  anatomy: [
    {
      name: "Select",
      indent: 0,
      note: "Root (manages open state, value, search, focus). Accepts width prop: sm/md/lg/full",
    },
    {
      name: "SelectTrigger",
      indent: 1,
      note: "Button that opens/closes the dropdown",
    },
    {
      name: "SelectValue",
      indent: 2,
      note: "Displays selected value or placeholder. Props: display (count|list|truncate), truncateAfter, children as render function.",
    },
    {
      name: "SelectTags",
      indent: 2,
      note: "Displays selected items as removable outlined chips (multiple select)",
    },
    {
      name: "SelectContent",
      indent: 1,
      note: "Dropdown listbox with keyboard navigation",
    },
    {
      name: "SelectSearch",
      indent: 2,
      note: "Filter input. Use position='top' to place at the top of the list (flips border direction)",
    },
    {
      name: "SelectItem",
      indent: 2,
      note: "Selectable option. indicator prop: auto/checkbox/radio/none. textValue prop for custom search text.",
    },
    {
      name: "SelectEmpty",
      indent: 2,
      note: "Shows '> no results.' when no items match the search query. Accepts children.",
    },
  ],
  notes: [
    {
      title: "Card Variant",
      content:
        "Set variant='card' on Select for an always-visible, inline selection list with checkbox-style indicators and a thick border treatment. Useful for settings panels.",
    },
    {
      title: "Multiple Selection",
      content:
        "Set multiple={true} to enable multi-select. Value becomes string[] instead of string. Items show [x]/[ ] checkbox indicators in multiple mode by default. The dropdown stays open after selection.",
    },
    {
      title: "Item Indicators",
      content:
        "Control the visual indicator on SelectItem via the indicator prop: 'auto' (default, [x]/[ ] in multi, ✓ in single), 'checkbox' (always [x]/[ ]), 'radio' ([ • ]/[ ] radio-style), or 'none' (text-only, no prefix). Use 'none' for tag-style multiselect, 'radio' for single-choice lists.",
    },
    {
      title: "SelectTags vs SelectValue",
      content:
        "Use SelectTags inside SelectTrigger for multiselect — it renders each selected item as a removable [label ✕] outlined chip. Use SelectValue for single-select or multiselect with display modes: 'count' (default, 'N selected'), 'list' (comma-separated), or 'truncate' (first N + '+M more'). Both accept ReactNode placeholder.",
    },
    {
      title: "Search Position",
      content:
        "SelectSearch can go anywhere inside SelectContent. Use position='top' to place it at the top (border-b instead of border-t). Use position='bottom' (default) for the classic search-at-bottom pattern.",
    },
    {
      title: "Empty State",
      content:
        "Add SelectEmpty inside SelectContent to show a message when no items exist or none match the current search query. Default: '> no results.' Pass children to customize.",
    },
    {
      title: "Keyboard Navigation",
      content:
        "SelectContent includes built-in keyboard navigation via useNavigation: ArrowUp/Down to move, Enter/Space to select, Home/End to jump, Escape to close. Highlighted state is exposed via highlighted/onHighlight props on Select for external integration.",
    },
    {
      title: "Custom Trigger Content",
      content:
        "For advanced customization, pass a render function as children to SelectValue: <SelectValue>{({ selected, labels }) => ...}</SelectValue>. Use the public Select parts for custom trigger and value layouts.",
    },
  ],
  usage: { example: "select-default" },
  examples: [
    { name: "select-default", title: "Default" },
    { name: "select-searchable", title: "Searchable (bottom)" },
    { name: "select-search-top", title: "Searchable (top)" },
    { name: "select-multiple", title: "Multiple" },
    { name: "select-multiselect-simple", title: "Multiselect (list display)" },
    { name: "select-display-modes", title: "Display Modes" },
    { name: "select-avatar", title: "Avatar Picker (render children)" },
    { name: "select-tags", title: "Tags (Multiselect)" },
    { name: "select-radio", title: "Radio Style" },
    { name: "select-card", title: "Card Variant" },
  ],
  keyboard: {
    description:
      "SelectContent handles keyboard navigation automatically: ArrowUp/Down moves highlight, Enter/Space selects, Home/End jumps to first/last, Escape closes and returns focus to trigger.",
    examples: [
      { name: "select-default", title: "Default with keyboard navigation" },
      { name: "select-searchable", title: "Searchable with keyboard navigation" },
    ],
  },
}
