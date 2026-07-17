import type { ComponentDoc } from "./types";

export const commandPaletteDoc: ComponentDoc = {
  description:
    "Terminal-styled command palette with built-in search filtering, grouped items, and keyboard navigation. Uses native dialog element with backdrop blur. Two orthogonal visual axes on Content (frame and density) keep visual chrome configurable without touching internals.",
  notes: [
    {
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "CommandPalette's arrow-key navigation and focus restoration import from the required @diffgazer/keys peer. Package consumers must install @diffgazer/keys with @diffgazer/ui; packages are not yet published to npm, so use a local checkout until the first release. Importing @diffgazer/ui/components/command-palette without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
    {
      title: "Controlled Open State",
      content:
        "CommandPalette is opened from outside via open/onOpenChange. Wire a trigger button (or a global keyboard shortcut) to setOpen(true). Search and highlight state can also be controlled via search/onSearchChange and highlighted/onHighlightChange, or left uncontrolled.",
    },
    {
      title: "Built-in Filtering",
      content:
        "Items are filtered automatically as you type. Each item matches against its `value` prop (falls back to `id`). Pass `shouldFilter={false}` to disable and handle filtering yourself. Pass a custom `filter` function to override the default case-insensitive includes match. Filtering uses the live search value, including the controlled `search` prop when provided.",
    },
    {
      title: "Composition Contract",
      content:
        "Use CommandPalette.Item as an explicit child in the CommandPalette JSX tree, usually inside CommandPalette.List or CommandPalette.Group. Custom item UI belongs inside CommandPalette.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Built-in Keyboard Navigation",
      content:
        "CommandPalette integrates @diffgazer/keys's useNavigation internally for arrow-key navigation, wrapping, and Enter activation. Hover (mousemove) and keyboard selection share the same highlighted state, so mousing over an item moves the cmdk-style cursor. Highlight and search state can be controlled externally via highlighted/onHighlightChange and search/onSearchChange.",
    },
    {
      title: "Variants & Density",
      content:
        'CommandPaletteContent exposes two orthogonal axes. `frame` picks the shell chrome — "border" (1px hairline, default), "viewfinder" (no border, four corner brackets + 2px left accent bar on selection), "terminal" (top + bottom 2px rules, inverted selection, prefix glyph becomes $), "card" (rounded 8px shell with a subtle gradient surface and floating rounded selection — Linear-ish), or "none" (bare shell for embedding). `density` picks the typographic & spacing surface — "compact" (default), "comfortable", or "dense". Both are plain TypeScript types (CommandPaletteFrame, CommandPaletteDensity) whose visual styling is driven by [data-frame] / [data-density] selectors in command-palette/command-palette.css, so consumers can override token values per-instance via CSS custom properties.',
    },
    {
      title: "Optional auto-coloring",
      content:
        'Items accept a `tone` prop ("neutral" | "nav" | "action" | "settings" | "destructive" | "ai") that renders a 2px left accent bar and tints the optional icon. The label color is unchanged so contrast remains readable, including under the terminal frame\'s inverted selection. For automatic classification + inline match highlighting, import `CommandPaletteHighlightItem` from `@diffgazer/ui/components/command-palette/highlight`. It infers tone from a small regex table (verbs like "delete", "go to", "toggle", "ask", "run") and wraps matched characters in `<mark data-slot="command-palette-item-match">`.',
    },
  ],
  anatomy: [
    {
      name: "CommandPalette",
      indent: 0,
      note: "Root (manages open state, search, highlighted item, filtering)",
    },
    {
      name: "CommandPaletteContent",
      indent: 1,
      note: "Native dialog modal container with frame + density variants",
    },
    {
      name: "CommandPaletteInput",
      indent: 2,
      note: "Search input with prefix/suffix slots (Esc Kbd by default)",
    },
    { name: "CommandPaletteList", indent: 2, note: "Scrollable item container" },
    { name: "CommandPaletteEmpty", indent: 3, note: "Shown when no items match search" },
    { name: "CommandPaletteGroup", indent: 3, note: "Labeled group of items" },
    {
      name: "CommandPaletteItem",
      indent: 4,
      note: "Selectable item with icon, shortcut, tone, value",
    },
    { name: "CommandPaletteFooter", indent: 2, note: "Hint bar / status area" },
  ],
  usage: { example: "command-palette-demo" },
  examples: [
    { name: "command-palette-demo", title: "Default" },
    { name: "command-palette-viewfinder", title: "Viewfinder frame" },
    { name: "command-palette-terminal", title: "Terminal frame" },
    { name: "command-palette-comfortable", title: "Comfortable density" },
    { name: "command-palette-dense", title: "Dense density" },
    { name: "command-palette-tones", title: "Tones (manual)" },
    { name: "command-palette-auto-tones", title: "Tones (auto-coloring)" },
  ],
  keyboard: {
    description:
      "Arrow keys navigate items (with wrapping), Enter activates the highlighted item. Home and End retain their native search-input editing behavior and do not move the highlight. Escape clears search first, then closes the palette. Hovering (mousemove) over an item also moves the highlight, so mouse and keyboard share a single selection model. Navigation is handled internally via @diffgazer/keys's useNavigation hook.",
    keys: [
      { keys: "ArrowUp / ArrowDown", action: "Moves highlight through enabled visible items." },
      { keys: "Enter", action: "Activates the highlighted item." },
      { keys: "Escape", action: "Clears the search query first, then closes the palette." },
    ],
    examples: [{ name: "command-palette-demo", title: "Keyboard navigation" }],
  },
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "CommandPaletteContent",
      values: '"open" | "closed"',
      description: "Native dialog open state mirrored by the shared shell.",
    },
    {
      attribute: "data-frame",
      appliesTo: "CommandPaletteContent",
      values: '"border" | "viewfinder" | "terminal" | "card" | "none"',
      description: "Shell chrome variant.",
    },
    {
      attribute: "data-density",
      appliesTo: "CommandPaletteContent",
      values: '"compact" | "comfortable" | "dense"',
      description: "Typographic and spacing density.",
    },
    {
      attribute: "data-value",
      appliesTo: "CommandPaletteItem",
      values: "item id",
      description: "Stable id used for filtering, highlight, and activation.",
    },
    {
      attribute: "data-tone",
      appliesTo: "CommandPaletteItem",
      values: '"neutral" | "nav" | "action" | "settings" | "destructive" | "ai"',
      description: "Semantic tone for the optional accent bar and icon tint.",
    },
  ],
  props: {
    CommandPalette: {
      open: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Controlled open state. Required to actually show the palette — wire a trigger button or shortcut to setOpen(true).",
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
        description:
          "Called when an item is activated (Enter or click). Fires after the item's own onSelect.",
      },
      shouldFilter: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          "Auto-filter items by search. Pass false to handle filtering yourself (e.g. server-side).",
      },
      filter: {
        type: "(value: string, search: string) => boolean",
        required: false,
        defaultValue: null,
        description:
          "Custom filter function. Defaults to case-insensitive substring match on the item's value (or id).",
      },
    },
    CommandPaletteContent: {
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Modal width preset.",
      },
      frame: {
        type: '"border" | "viewfinder" | "terminal" | "card" | "none"',
        required: false,
        defaultValue: '"border"',
        description:
          'Shell chrome style. "border" renders a 1px hairline. "viewfinder" renders four corner brackets with no border plus a 2px left accent bar on the selected row. "terminal" renders top + bottom 2px rules with inverted selection and swaps the default prefix glyph from > to $. "card" renders an 8px rounded shell with a subtle gradient surface and a floating rounded selection (compose with a search-icon `prefix` for the Linear look). "none" is a bare shell for embedding.',
      },
      density: {
        type: '"compact" | "comfortable" | "dense"',
        required: false,
        defaultValue: '"compact"',
        description:
          'Typographic and spacing surface. Switches a token block (--command-palette-row-h, --command-palette-input-py, --command-palette-list-p, --command-palette-text-size, etc.) consumed by every inner slot via [data-density] selectors in command-palette/command-palette.css. "compact" matches the V1 refined-mono target, "comfortable" is Linear-ish breathing room, "dense" is VSCode-tight.',
      },
      label: {
        type: "string",
        required: false,
        defaultValue: '"Command palette"',
        description: "Accessible name for the modal dialog.",
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
      icon: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Optional leading icon. Inherits tone color when a non-neutral tone is set.",
      },
      shortcut: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Keyboard shortcut hint rendered next to the label.",
      },
      tone: {
        type: '"neutral" | "nav" | "action" | "settings" | "destructive" | "ai"',
        required: false,
        defaultValue: '"neutral"',
        description:
          "Semantic tone. Renders a 2px left bar and tints the optional icon via [data-tone] selectors. The label color stays inherited so contrast holds under any frame. Map: nav→info, action→success, settings→warning, destructive→destructive, ai→accent.",
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
      label: {
        type: "string",
        required: false,
        defaultValue: '"Command search"',
        description: "Accessible label for the search input.",
      },
      placeholder: {
        type: "string",
        required: false,
        defaultValue: '"Type a command…"',
        description: "Search input placeholder.",
      },
      prefix: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          'Optional leading content. When omitted, a CSS-driven glyph from --command-palette-prefix-content is rendered (default ">"; terminal frame swaps to "$").',
      },
      suffix: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: 'Optional trailing content. Defaults to a Kbd "Esc" hint.',
      },
    },
  },
};
