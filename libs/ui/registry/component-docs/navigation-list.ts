import type { ComponentDoc } from "./types";

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
    { name: "NavigationList.Status", indent: 2, note: "Top-right status marker" },
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
      title: "Composition Contract",
      content:
        "Use NavigationList.Item and its static parts as explicit children in the NavigationList JSX tree. Custom item UI belongs inside NavigationList.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Density",
      content: "density prop controls spacing — compact, default, or comfortable.",
    },
    {
      title: "Rich Items",
      content:
        "NavigationList.Item supports compound parts: NavigationList.Title, NavigationList.Meta, NavigationList.Badge, NavigationList.Subtitle, and NavigationList.Status.",
    },
    {
      title: "Built-in Keyboard API",
      content:
        "NavigationList includes arrow-key navigation and exposes highlighted, onHighlightChange, onEnter, onNavigationBoundaryReached, autoFocus, focused, and onKeyDown for controlled highlight state or extra app-level shortcuts.",
    },
    {
      title: "Group Expand/Collapse",
      content:
        "Group expand/collapse is a mouse-only visual enhancement. Keyboard users navigate all visible items directly via arrow keys. The ARIA listbox pattern does not support focusable group toggles; keyboard-operable group toggling would require restructuring to the ARIA tree pattern.",
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
      "Arrow keys navigate between items with wrapping. Enter activates the highlighted item. Home and End jump to the first and last items.",
    examples: [
      { name: "navigation-list-interactive", title: "External @diffgazer/keys navigation" },
    ],
  },
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
        description: "Fired when an item is activated by click or Enter.",
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
      indicator: {
        type: '"bar" | "bar-thick" | "arrow" | "bracket"',
        required: false,
        defaultValue: '"bar"',
        description: "Visual indicator style for the active/selected item.",
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
        description: "Badge color token. See Badge for full prop reference.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"sm"',
        description: "Badge size token.",
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
        description: "Progress percentage (0-100).",
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
        description: "Number of characters for the progress bar.",
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
