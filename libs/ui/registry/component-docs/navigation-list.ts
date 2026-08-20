import type { ComponentDoc } from "./types.js";

export const navigationListDoc: ComponentDoc = {
  description:
    "Terminal-styled navigation sidebar list with selection, keyboard navigation, and composable item parts.",
  anatomy: [
    { name: "NavigationList", indent: 0, note: "Root (manages selection state)" },
    {
      name: "NavigationList.Group",
      indent: 1,
      note: "Collapsible group with header (section or tree variant)",
    },
    { name: "NavigationList.Item", indent: 1, note: "Selectable list item container" },
    { name: "NavigationList.Title", indent: 2, note: "Primary item label" },
    {
      name: "NavigationList.Status",
      indent: 2,
      note: "Top-right status marker (muted by default)",
    },
    { name: "NavigationList.Meta", indent: 2, note: "Row 2 container for badges and subtitles" },
    {
      name: "NavigationList.Badge",
      indent: 2,
      note: "Standardized badge slot (uses Badge primitive)",
    },
    { name: "NavigationList.Subtitle", indent: 2, note: "Secondary metadata text" },
    { name: "NavigationList.Progress", indent: 3, note: "ASCII progress bar (in Meta)" },
  ],
  notes: [
    {
      title: "Current-location mark",
      content:
        'The library spells "you are here" one way: a 2px left rail in --primary (registry/lib/marker-rail.ts). Full-bleed inversion is reserved for the TRANSIENT keyboard highlight; a row that is both the current location and the highlight keeps the inversion and flips its rail to --primary-foreground so the mark survives. The rail is reserved transparently in the resting state and pulled back by its own width, so a row\'s label never shifts horizontally when it becomes current \u2014 that anti-shift geometry is the contract, and it is why the rail costs 0px of label width at 375/390 where a full-bleed fill reads as a solid slab. NavigationList therefore draws a rail on the selected row instead of relying on the full-bleed fill alone, and the inner indicator no longer halves its opacity in `bar` mode.',
    },
    {
      title: "Composition Contract",
      content:
        "Use NavigationList.Item and its static parts as explicit children in the NavigationList JSX tree. Custom item UI belongs inside NavigationList.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Density",
      content:
        "density prop controls item padding — compact (6px), default (12px), or comfortable (20px).",
    },
    {
      title: "Rich Items",
      content:
        "NavigationList.Item supports compound parts: NavigationList.Title, NavigationList.Meta, NavigationList.Badge, NavigationList.Subtitle, and NavigationList.Status.",
    },
    {
      title: "Built-in Keyboard API",
      content:
        "NavigationList includes arrow-key navigation with the vim aliases j/k and exposes highlighted, onHighlightChange, onEnter, onNavigationBoundaryReached, autoFocus, focused, and onKeyDown for controlled highlight state or extra app-level shortcuts.",
    },
    {
      title: "Group Expand/Collapse",
      content:
        "Group headers participate in list navigation. ArrowRight expands a collapsed group, ArrowLeft collapses an expanded group, and Enter or Space toggles the highlighted group.",
    },
  ],
  usage: { example: "navigation-list-default" },
  examples: [
    { name: "navigation-list-default", title: "Default" },
    { name: "navigation-list-density", title: "Density Variants" },
    { name: "navigation-list-interactive", title: "Controlled Selection" },
    { name: "navigation-list-progress", title: "Progress Bars" },
    { name: "navigation-list-sections", title: "Section Groups" },
    { name: "navigation-list-tree", title: "Tree View" },
    { name: "navigation-list-indicators", title: "Indicator Variants" },
  ],
  keyboard: {
    description:
      "Arrow keys and their vim aliases j/k navigate between items with wrapping. Enter activates the highlighted item. Home and End jump to the first and last items.",
    keys: [
      {
        keys: "ArrowUp / k",
        action: "Moves highlight to the previous enabled item.",
      },
      {
        keys: "ArrowDown / j",
        action: "Moves highlight to the next enabled item.",
      },
      { keys: "Home / End", action: "Moves highlight to the first or last enabled item." },
      { keys: "Enter", action: "Activates the highlighted item via onEnter or onSelect." },
      {
        keys: "ArrowRight",
        action: "Expands the highlighted group header when it is collapsed.",
      },
      {
        keys: "ArrowLeft",
        action: "Collapses the highlighted group header when it is expanded.",
      },
      { keys: "Enter / Space", action: "Toggles the highlighted group header." },
      {
        keys: "Boundary ArrowUp / ArrowDown / k / j",
        action:
          "Calls onNavigationBoundaryReached with the pressed key when wrap is false and focus attempts to leave the list.",
      },
    ],
    examples: [
      { name: "navigation-list-interactive", title: "External @diffgazer/keys navigation" },
    ],
  },
  dataAttributes: [
    {
      attribute: "data-highlighted",
      appliesTo: "NavigationList.Item",
      values: "present when highlighted",
      description: "Marks the active descendant for keyboard and pointer styling.",
    },
    {
      attribute: "data-selected",
      appliesTo: "NavigationList.Item",
      values: "present when selected",
      description: "Marks the currently selected item.",
    },
    {
      attribute: "data-value",
      appliesTo: "NavigationList.Item",
      values: "item id",
      description: "Stable item id used by keyboard navigation.",
    },
    {
      attribute: "data-indicator",
      appliesTo: "NavigationList.Item indicator slot (non-tree items)",
      values: '"bar" | "bar-thick" | "arrow" | "bracket"',
      description:
        "Active indicator visual treatment. Emitted on the leading indicator cell inside the item, not on the option root.",
    },
    {
      attribute: "data-state",
      appliesTo: "NavigationList.Group header",
      values: '"open" | "closed"',
      description: "Group disclosure state changed by pointer or keyboard activation.",
    },
  ],
  props: {
    NavigationList: {
      selectedId: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: "Controlled selected item id.",
      },
      defaultSelectedId: {
        type: "string | null",
        required: false,
        defaultValue: "null",
        description: "Initial selected id for uncontrolled mode.",
      },
      highlighted: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: "Controlled highlighted (focused) item id.",
      },
      defaultHighlighted: {
        type: "string | null",
        required: false,
        defaultValue: "null",
        description: "Initial highlighted id for uncontrolled mode.",
      },
      onSelect: {
        type: "(id: string) => void",
        required: false,
        defaultValue: null,
        description:
          "Fired when an item is activated by click, Enter, or Space — including the already-selected item.",
      },
      onEnter: {
        type: "(id: string, event: KeyboardEvent) => void",
        required: false,
        defaultValue: null,
        description:
          "Fired when Enter activates an item. Receives the raw keyboard event for modifier-key handling.",
      },
      onHighlightChange: {
        type: "(id: string | null) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the highlighted item changes.",
      },
      onNavigationBoundaryReached: {
        type: '(direction: "previous" | "next", event: KeyboardEvent, key: string) => void',
        required: false,
        defaultValue: null,
        description:
          "Fired when arrow navigation reaches the first/last item with wrap disabled, enabling cross-list navigation.",
      },
      focused: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          "When false, removes the active visual treatment from the selected/highlighted item (useful when focus is elsewhere).",
      },
      wrap: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "When true, arrow navigation wraps at list boundaries.",
      },
      typeahead: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          "Enable type-ahead character search to jump to matching items. Disable when every printable key the list's screen advertises belongs to an external hotkey layer.",
      },
      indicator: {
        type: '"bar" | "bar-thick" | "arrow" | "bracket"',
        required: false,
        defaultValue: '"bar"',
        description:
          "Visual indicator style for the active/selected item. bar is a 4px rail at 40% fill, bar-thick an 8px rail at full fill; arrow and bracket mark the title glyph instead.",
      },
      autoFocus: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Auto-focus the list on mount.",
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Accessible name for the list container.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "NavigationList.Item children.",
      },
    },
    "NavigationList.Item": {
      id: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier matched against selectedId/highlighted.",
      },
      density: {
        type: '"compact" | "default" | "comfortable"',
        required: false,
        defaultValue: '"default"',
        description: "Padding scale for the item content.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables activation; item is rendered with aria-disabled.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Item subparts (Title, Status, Meta, Badge, Subtitle).",
      },
    },
    "NavigationList.Title": {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Primary label. Used as aria-labelledby for the item.",
      },
    },
    "NavigationList.Status": {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Top-right status marker.",
      },
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "Merged onto the marker. The slot is muted by default; pass a semantic tone (text-warning, text-error, text-success) at call sites where the status carries that meaning.",
      },
    },
    "NavigationList.Meta": {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Container for inline metadata (badges, dates). Wired to aria-describedby.",
      },
    },
    "NavigationList.Subtitle": {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Secondary metadata text. Wired to aria-describedby.",
      },
    },
    "NavigationList.Badge": {
      variant: {
        type: '"success" | "warning" | "error" | "info" | "neutral"',
        required: false,
        defaultValue: '"neutral"',
        description:
          "Semantic color token. Picks foreground, background, border, and dot color together for the Badge. See Badge for full prop reference.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"sm"',
        description: "Padding and font-size / Badge size token.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Badge label.",
      },
    },
    "NavigationList.Group": {
      label: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Group header text.",
      },
      expanded: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled expanded state.",
      },
      defaultExpanded: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Initial expanded state for uncontrolled mode.",
      },
      onExpandedChange: {
        type: "(expanded: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Fired when expanded state changes.",
      },
      count: {
        type: "number",
        required: false,
        defaultValue: null,
        description: "Optional count shown next to the label in section variant.",
      },
      variant: {
        type: '"tree" | "section"',
        required: false,
        defaultValue: '"section"',
        description:
          'Visual treatment. "section" shows uppercase headers with counts, "tree" shows indented hierarchy with ASCII connectors.',
      },
      headerId: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Stable header identity. Defaults to a per-instance generated value.",
      },
      expandLabel: {
        type: "string",
        required: false,
        defaultValue: '"expand"',
        description:
          "Accessible action word appended to the header name while collapsed. Override it to localize the disclosure verb.",
      },
      collapseLabel: {
        type: "string",
        required: false,
        defaultValue: '"collapse"',
        description:
          "Accessible action word appended to the header name while expanded. Override it to localize the disclosure verb.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "NavigationList.Item or nested NavigationList.Group children.",
      },
    },
    "NavigationList.Progress": {
      value: {
        type: "number",
        required: true,
        defaultValue: null,
        description:
          "Progress percentage (0-100). Values are clamped to that range; non-finite values become zero.",
      },
      variant: {
        type: '"block" | "bar"',
        required: false,
        defaultValue: '"block"',
        description: 'Bar style. "block" uses █░ characters, "bar" uses [==-] characters.',
      },
      width: {
        type: "number",
        required: false,
        defaultValue: "10",
        description:
          "Number of characters for the progress bar. Values are rounded down and capped at 200; negative and non-finite values become zero.",
      },
      color: {
        type: '"auto" | "success" | "warning" | "error" | "muted"',
        required: false,
        defaultValue: '"auto"',
        description: "Color token. Auto selects color based on value thresholds.",
      },
      showLabel: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Shows percentage text after the bar.",
      },
    },
  },
};
