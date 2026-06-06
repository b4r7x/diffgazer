import type { ComponentDoc } from "./types"

export const selectDoc: ComponentDoc = {
  description:
    "Dropdown select with search, multiple selection, card variant, and controlled keyboard integration points. 8 composable parts.",
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
      note: "Displays selected items as outlined chips (multiple select)",
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
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "Select's built-in keyboard navigation imports from the required @diffgazer/keys peer. Package/npm consumers must install it: `npm install @diffgazer/keys`. Importing @diffgazer/ui/components/select without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
    {
      title: "Composition Contract",
      content:
        "Use Select.Trigger, Select.Content, Select.Item, and the other Select parts as explicit children in the Select JSX tree. Custom option UI belongs inside Select.Item, with textValue when the visible content is not plain text. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Card Variant",
      content:
        "Set variant='card' on Select for a settings-panel layout with checkbox-style indicators and a thick border treatment. The list still respects open/defaultOpen — pass defaultOpen to render the inline list immediately, or pair with open/onOpenChange to control expansion.",
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
        "Use SelectTags inside SelectTrigger for multiselect — it renders each selected item as an outlined chip showing the option label. Use SelectValue for single-select or multiselect with display modes: 'count' (default, 'N selected'), 'list' (comma-separated), or 'truncate' (first N + '+M more'). Both accept ReactNode placeholder.",
    },
    {
      title: "Search Position",
      content:
        "SelectSearch can go anywhere inside SelectContent. Use position='top' to place it at the top (border-b instead of border-t). Use position='bottom' (default) for the classic search-at-bottom pattern.",
    },
    {
      title: "Searchable APG semantics",
      content:
        "When SelectSearch is present, Select implements the WAI-ARIA Editable Combobox With List Autocomplete pattern: the search input is the combobox (role='combobox', aria-controls -> listbox, aria-activedescendant on focused option, aria-autocomplete='list'). The trigger button reduces to a simple toggle (aria-haspopup='listbox' + aria-expanded). When no SelectSearch is present, the trigger button itself is the combobox following the Combobox With Listbox Popup pattern. This avoids splitting combobox state across two controls.",
    },
    {
      title: "Empty State",
      content:
        "Add SelectEmpty inside SelectContent to show a message when no items exist or none match the current search query. Default: '> no results.' Pass children to customize.",
    },
    {
      title: "Keyboard Navigation",
      content:
        "SelectContent includes built-in keyboard navigation via useNavigation: ArrowUp/Down to move, Enter/Space to select, Home/End to jump, Escape to close. Highlight state is exposed via highlighted/onHighlightChange props on Select for external integration.",
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
  props: {
    Select: {
      value: {
        type: "string | string[]",
        required: false,
        defaultValue: null,
        description: "Controlled selected value. string[] when multiple, string in single mode.",
      },
      defaultValue: {
        type: "string | string[]",
        required: false,
        defaultValue: null,
        description: "Initial selected value for uncontrolled usage.",
      },
      onChange: {
        type: "(value: string) => void | (value: string[]) => void",
        required: false,
        defaultValue: null,
        description: "Called when the selection changes.",
      },
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled open state. Pair with onOpenChange.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Initial open state for uncontrolled usage. Useful with variant=\"card\" for a settings-panel layout that renders its list immediately.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Called when open state changes.",
      },
      multiple: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Enable multi-select. value/onChange become string[].",
      },
      variant: {
        type: '"default" | "card"',
        required: false,
        defaultValue: '"default"',
        description: "Visual treatment. \"card\" renders the inline settings-panel layout (combine with defaultOpen).",
      },
      width: {
        type: '"sm" | "md" | "lg" | "full"',
        required: false,
        defaultValue: null,
        description: "Width preset for the Select container. \"full\" fills the parent.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disable the trigger and prevent open.",
      },
      name: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Name for the hidden form input that participates in native form submission.",
      },
      required: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Mark the select as required for native form validation.",
      },
      highlighted: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: "Controlled highlighted item id. Pair with onHighlightChange.",
      },
      onHighlightChange: {
        type: "(value: string | null) => void",
        required: false,
        defaultValue: null,
        description: "Called when the highlighted item changes via keyboard or search.",
      },
    },
    SelectTrigger: {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Trigger label. Use SelectValue or SelectTags for selection display.",
      },
      handle: {
        type: "ReactNode | null",
        required: false,
        defaultValue: "Chevron",
        description: "Custom trigger handle. Pass null to hide the default chevron.",
      },
    },
    SelectValue: {
      placeholder: {
        type: "ReactNode",
        required: false,
        defaultValue: '"Select..."',
        description: "Rendered when nothing is selected.",
      },
      display: {
        type: '"count" | "list" | "truncate"',
        required: false,
        defaultValue: '"count"',
        description: "Multi-select display mode. \"count\" shows N selected, \"list\" comma-separates, \"truncate\" shows first N + \"+M more\".",
      },
      truncateAfter: {
        type: "number",
        required: false,
        defaultValue: "2",
        description: "Number of items shown before \"+N more\" when display=\"truncate\".",
      },
      children: {
        type: "(state: { selected: string[]; labels: string[] }) => ReactNode",
        required: false,
        defaultValue: null,
        description: "Render function for fully custom selection display.",
      },
    },
    SelectTags: {
      placeholder: {
        type: "string",
        required: false,
        defaultValue: '"Select..."',
        description: "Rendered when nothing is selected. Only available in multi-select mode.",
      },
    },
    SelectSearch: {
      position: {
        type: '"top" | "bottom"',
        required: false,
        defaultValue: '"bottom"',
        description: "Where the search input sits in SelectContent. \"top\" flips the border direction.",
      },
    },
    SelectItem: {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Item value. Must be unique within the Select.",
      },
      indicator: {
        type: '"auto" | "checkbox" | "radio" | "none"',
        required: false,
        defaultValue: '"auto"',
        description: "Selection indicator style. \"auto\" picks checkbox in multi mode and a check mark in single mode.",
      },
      textValue: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Override the searchable/typeahead text when children are not plain text.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disable the option.",
      },
    },
    SelectEmpty: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: '"> no results."',
        description: "Custom empty-state content.",
      },
    },
  },
}
