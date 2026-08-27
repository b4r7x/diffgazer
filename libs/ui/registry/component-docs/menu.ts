import type { ComponentDoc } from "./types.js";

export const menuDoc: ComponentDoc = {
  description:
    "Terminal-styled selection list with keyboard navigation, highlighting and optional hotkey indicators.",
  anatomy: [
    { name: "Menu", indent: 0, note: "Root (manages selection, variant context)" },
    { name: "MenuItem", indent: 1, note: "Selectable item with optional hotkey, value, variant" },
    { name: "MenuDivider", indent: 1, note: "Visual separator between groups" },
    { name: "MenuGroup", indent: 1, note: "Semantic group with optional label" },
    { name: "MenuLabel", indent: 2, note: "Group label text" },
    { name: "MenuItemCheckbox", indent: 1, note: "Toggleable checkbox item" },
    { name: "MenuItemRadio", indent: 1, note: "Radio-style selectable item" },
    { name: "MenuSub", indent: 1, note: "Submenu container (manages open state)" },
    { name: "MenuSubTrigger", indent: 2, note: "Trigger item that opens the submenu" },
    {
      name: "MenuSubContent",
      indent: 2,
      note: "Submenu content — a side flyout, or a drill-down inside the parent panel",
    },
    {
      name: "MenuStackBack",
      indent: 3,
      note: "Sticky back row rendered automatically in drill-down mode",
    },
  ],
  notes: [
    {
      title: "Composition Contract",
      content:
        "Use Menu.Item and Menu.Divider as explicit children in the Menu JSX tree. Custom item UI belongs inside Menu.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Row Columns",
      content:
        "A default row is icon, label, accelerator. The label column starts immediately after the icon and the [n] accelerator is pushed to the row end, so rows with and without an accelerator keep their labels aligned. Detail rows keep the same shape with a right-aligned value instead of an accelerator.",
    },
    {
      title: "Submenu presentation",
      content:
        'Menu.Sub takes mode="flyout" | "stack" | "auto" (default "auto"). A flyout is a side-anchored panel. A stack is a drill-down: the submenu replaces the item list inside the SAME panel, at the same width and left edge, with a sticky back row that is both the breadcrumb and the pop control. "auto" resolves to stack at coarse pointer or below 640px, resolved before the submenu ever opens so touch never sees a flyout frame — a side flyout has nowhere to go on a narrow screen and ends up shifted back over the rows it came from, hiding them. The key model is identical in both: ArrowRight/Enter pushes, ArrowLeft/Escape pops, and Escape at the root level still closes the menu. While drilled in, the parent items are removed from the DOM tree that navigation reads, so arrow keys and typeahead never reach a row the user cannot see.',
    },
    {
      title: "Built-in Keyboard Navigation",
      content:
        "Menu includes keyboard navigation via useListbox (Arrow keys and their vim aliases j/k, Home/End, Enter/Space). For custom key bindings or cross-component navigation, use the highlighted, onHighlightChange, and onKeyDown props to add external handlers alongside the built-in behavior.",
    },
  ],
  usage: { example: "menu-default" },
  examples: [
    { name: "menu-detail", title: "Detail Variant" },
    { name: "menu-grouped", title: "Grouped with Labels" },
    { name: "menu-checkbox-radio", title: "Checkbox and Radio Items" },
    { name: "menu-icons", title: "Custom Icons" },
    { name: "menu-disabled", title: "Disabled Items" },
    { name: "menu-submenu", title: "Submenu" },
    { name: "menu-submenu-stack", title: "Submenu (drill-down stack)" },
    { name: "menu-keyboard", title: "Controlled Keyboard Navigation" },
  ],
  keyboard: {
    description:
      "Keyboard navigation is built-in. The Controlled Keyboard Navigation example above demonstrates controlled mode with explicit state management. Arrow keys and their vim aliases j/k move the highlight, Enter activates selection.",
    keys: [
      {
        keys: "ArrowUp / k",
        action:
          "Moves highlight to the previous item. Disabled items remain navigable and announced but cannot be activated.",
      },
      {
        keys: "ArrowDown / j",
        action:
          "Moves highlight to the next item. Disabled items remain navigable and announced but cannot be activated.",
      },
      {
        keys: "Home / End",
        action:
          "Moves highlight to the first or last item, including disabled items that remain nonactivatable.",
      },
      {
        keys: "Enter / Space",
        action: "Activates the highlighted item or toggles checkbox/radio items.",
      },
      {
        keys: "Printable character",
        action:
          "Starts or extends a typeahead query and moves the highlight to the matching item. j/k still move the highlight on an empty query buffer and only extend a query already in progress.",
      },
      { keys: "Escape / Tab", action: "Calls onClose on the root menu." },
      {
        keys: "ArrowRight",
        action:
          "Opens the highlighted nested submenu. On a leaf item it does nothing and stays within the current submenu.",
      },
      {
        keys: "ArrowLeft / Escape",
        action: "Closes submenu content and returns focus to its trigger.",
      },
    ],
    // The controlled demo already renders in Examples above; a second mount here
    // would repeat it on the same page.
    examples: [],
  },
  dataAttributes: [
    {
      attribute: "data-highlighted",
      appliesTo: "MenuItem / MenuItemCheckbox / MenuItemRadio / MenuSubTrigger",
      values: "present when highlighted",
      description:
        "Marks the active descendant for keyboard highlight styling, including disabled items that remain discoverable but cannot activate.",
    },
    {
      attribute: "data-hovered",
      appliesTo: "MenuItem / MenuItemCheckbox / MenuItemRadio / MenuSubTrigger / MenuStackBack",
      values: "present when pointer-hovered",
      description:
        "Cosmetic pointer hover styling hook. It never enters the accessibility tree and does not move the active descendant.",
    },
    {
      attribute: "data-state",
      appliesTo: "MenuItemCheckbox / MenuItemRadio",
      values: '"checked" | "unchecked"',
      description: "Enumerated check state for styling hooks in copy mode.",
    },
    {
      attribute: "data-selected",
      appliesTo: "MenuItem / MenuItemRadio",
      values: "present when selected",
      description: "Marks the selected item in selection/radio menu modes.",
    },
    {
      attribute: "data-value",
      appliesTo: "MenuItem / MenuItemCheckbox / MenuItemRadio / MenuSubTrigger",
      values: "item id",
      description: "Stable item id used by keyboard navigation and typeahead.",
    },
    {
      attribute: "data-diffgazer-navigation-item",
      appliesTo: "Menu items",
      values: '"true"',
      description: "Marks descendants discoverable by @diffgazer/keys navigation utilities.",
    },
  ],
  props: {
    Menu: {
      selectedId: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description:
          'Controlled selected item id. Pair with onSelect. Switches item role to "menuitemradio" with aria-checked.',
      },
      defaultSelectedId: {
        type: "string | null",
        required: false,
        defaultValue: "null",
        description:
          "Initial selected id for uncontrolled mode. Setting this to a non-null value enables selection semantics.",
      },
      highlighted: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: "Controlled highlighted (focused) item id. Pair with onHighlightChange.",
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
        description: "Fired when an item is activated by click, Enter, or Space.",
      },
      onHighlightChange: {
        type: "(value: string | null) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the highlighted item changes via arrow keys, typeahead, or mouse.",
      },
      onClose: {
        type: "() => void",
        required: false,
        defaultValue: null,
        description: "Fired when Escape or Tab is pressed.",
      },
      variant: {
        type: '"default" | "detail"',
        required: false,
        defaultValue: '"default"',
        description:
          "Visual layout. `detail` renders taller rows with a right-aligned value column, for menus where each item carries a status or summary value.",
      },
      wrap: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "When true, arrow navigation wraps from last item to first and vice versa.",
      },
      typeahead: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          "Enable type-ahead character search to jump to matching items. Submenus inherit this setting. Disable when every printable key the menu advertises belongs to an external hotkey layer.",
      },
      autoFocus: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description:
          "Auto-focus the menu container on mount so arrow keys work without an explicit click.",
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: null,
        description: 'Accessible name for the menu container (role="menu").',
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "MenuItem and MenuDivider children.",
      },
    },
    MenuItem: {
      id: {
        type: "string",
        required: true,
        defaultValue: null,
        description:
          "Stable identifier matched against selectedId/highlighted and passed to onSelect.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Disables activation while keeping the item in the navigation order with aria-disabled.",
      },
      variant: {
        type: '"default" | "danger"',
        required: false,
        defaultValue: '"default"',
        description: "Danger applies destructive coloring for destructive actions.",
      },
      hotkey: {
        type: "number | string",
        required: false,
        defaultValue: null,
        description: "Decorative hotkey label rendered as [n]. Does not bind a key listener.",
      },
      value: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Detail variant only. Right-aligned value (badge, count, or status text).",
      },
      valueVariant: {
        type: '"default" | "success" | "success-badge" | "muted"',
        required: false,
        defaultValue: '"default"',
        description:
          "Color treatment for the detail value. The success variants prefix a ✓ so the passing state does not rest on color alone.",
      },
      icon: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Leading icon rendered in the indicator slot. Replaces the default ▌/> indicator when provided.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Item label.",
      },
    },
    MenuDivider: {
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          'Class applied to the separator. Renders role="separator" with horizontal orientation.',
      },
    },
    MenuGroup: {
      label: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Optional label rendered via MenuLabel. When provided, the group is labelled via aria-labelledby.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "MenuItem, MenuItemCheckbox, MenuItemRadio, or MenuDivider children.",
      },
    },
    MenuLabel: {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Label text for a MenuGroup.",
      },
    },
    MenuItemCheckbox: {
      id: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier for the checkbox item.",
      },
      checked: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled checked state.",
      },
      defaultChecked: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Initial checked state for uncontrolled mode.",
      },
      onChange: {
        type: "(checked: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the checked state toggles.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the checkbox item.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Checkbox item label.",
      },
    },
    MenuItemRadio: {
      id: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier for the radio item.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the radio item.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Radio item label.",
      },
    },
    MenuSub: {
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled open state for the submenu.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Initial open state for uncontrolled mode.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the submenu open state changes.",
      },
      mode: {
        type: '"flyout" | "stack" | "auto"',
        required: false,
        defaultValue: '"auto"',
        description:
          'Presentation. "flyout" opens a side-anchored panel; "stack" drills down inside the parent panel with a back row. "auto" picks stack on touch or below 640px, where a side flyout has nowhere to go.',
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "MenuSubTrigger and MenuSubContent children.",
      },
    },
    MenuSubTrigger: {
      id: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier for the submenu trigger item.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the submenu trigger.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Trigger label.",
      },
    },
    MenuSubContent: {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Menu items rendered inside the submenu floating panel.",
      },
      sideOffset: {
        type: "number",
        required: false,
        defaultValue: "0",
        description: "Offset from the trigger edge in pixels.",
      },
    },
  },
};
