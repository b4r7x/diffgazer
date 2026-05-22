import type { ComponentDoc } from "./types"

export const menuDoc: ComponentDoc = {
  description: "Terminal-styled selection list with keyboard navigation, highlighting and optional hotkey indicators.",
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
    { name: "MenuSubContent", indent: 2, note: "Floating panel for submenu content" },
  ],
  notes: [
    {
      title: "Composition Contract",
      content: "Use Menu.Item and Menu.Divider as explicit children in the Menu JSX tree. Custom item UI belongs inside Menu.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Built-in Keyboard Navigation",
      content: "Menu includes keyboard navigation via useListbox (Arrow keys, Home/End, Enter/Space). For custom key bindings or cross-component navigation, use the highlighted, onHighlightChange, and onKeyDown props to add external handlers alongside the built-in behavior.",
    },
  ],
  usage: { example: "menu-default" },
  examples: [
    { name: "menu-default", title: "Default" },
    { name: "menu-nested", title: "Hub Variant" },
    { name: "menu-grouped", title: "Grouped with Labels" },
    { name: "menu-checkbox-radio", title: "Checkbox and Radio Items" },
    { name: "menu-icons", title: "Custom Icons" },
    { name: "menu-submenu", title: "Submenu" },
  ],
  keyboard: {
    description: "Keyboard navigation is built-in. The menu-keyboard example demonstrates controlled mode with explicit state management. Arrow keys move focus, Enter activates selection.",
    examples: [
      { name: "menu-keyboard", title: "Controlled keyboard navigation" },
    ],
  },
  props: {
    Menu: {
      selectedId: {
        type: "string | null",
        required: false,
        defaultValue: null,
        description: 'Controlled selected item id. Pair with onSelect. Switches item role to "menuitemradio" with aria-checked.',
      },
      defaultSelectedId: {
        type: "string | null",
        required: false,
        defaultValue: "null",
        description: "Initial selected id for uncontrolled mode. Setting this to a non-null value enables selection semantics.",
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
        type: '"default" | "hub"',
        required: false,
        defaultValue: '"default"',
        description: "Visual layout. Hub uses larger rows with right-aligned values for hub-style menus.",
      },
      wrap: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "When true, arrow navigation wraps from last item to first and vice versa.",
      },
      autoFocus: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Auto-focus the menu container on mount so arrow keys work without an explicit click.",
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
        description: "Stable identifier matched against selectedId/highlighted and passed to onSelect.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables activation while keeping the item in the navigation order with aria-disabled.",
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
        description: "Hub variant only. Right-aligned value (badge, count, or status text).",
      },
      valueVariant: {
        type: '"default" | "success" | "success-badge" | "muted"',
        required: false,
        defaultValue: '"default"',
        description: "Color treatment for the hub value.",
      },
      icon: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Leading icon rendered in the indicator slot. Replaces the default ▐/> indicator when provided.",
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
        description: "Class applied to the separator. Renders role=\"separator\" with horizontal orientation.",
      },
    },
    MenuGroup: {
      label: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Optional label rendered via MenuLabel. When provided, the group is labelled via aria-labelledby.",
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
      onCheckedChange: {
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
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Form-submission value for the radio item.",
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
}
