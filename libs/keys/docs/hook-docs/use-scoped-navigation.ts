import type { HookDoc } from "@diffgazer/registry";

export const useScopedNavigationDoc: HookDoc = {
  description:
    "Scope-aware keyboard navigation registered via KeyboardProvider. Use when navigation should respect the scope stack (e.g., modals, panels).",
  usage: {
    code: [
      `const { highlighted } = useScopedNavigation({`,
      `  containerRef,`,
      `  role: "menuitem",`,
      `})`,
    ].join("\n"),
    lang: "tsx",
  },
  parameters: [
    {
      name: "containerRef",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description: "Ref to the container element holding navigable items.",
    },
    {
      name: "role",
      type: '"radio" | "checkbox" | "option" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "button" | "tab"',
      required: true,
      description: "ARIA role used to query navigable children within the container.",
    },
    {
      name: "highlighted",
      type: "string | null",
      required: false,
      description: "Controlled highlight value.",
    },
    {
      name: "onHighlightChange",
      type: "(value: string | null) => void",
      required: false,
      description:
        "Called when the controlled highlight value should change. Receives null when highlight is cleared.",
    },
    {
      name: "onSelect",
      type: "(value: string, event: KeyboardEvent) => void",
      required: false,
      description: "Called when an item is selected via Space key.",
    },
    {
      name: "onEnter",
      type: "(value: string, event: KeyboardEvent) => void",
      required: false,
      description: "Called when Enter is pressed on the highlighted item.",
    },
    {
      name: "wrap",
      type: "boolean",
      required: false,
      description: "Wrap around when reaching the first or last item.",
      defaultValue: "true",
    },
    {
      name: "enabled",
      type: "boolean",
      required: false,
      description: "Whether the navigation hook is active.",
      defaultValue: "true",
    },
    {
      name: "preventDefault",
      type: "boolean",
      required: false,
      description: "Call preventDefault() on handled keyboard events.",
      defaultValue: "true",
    },
    {
      name: "onNavigationBoundaryReached",
      type: '(direction: "previous" | "next", event: KeyboardEvent, key: string) => void',
      required: false,
      description:
        "Called when the user tries to navigate past the first or last item. Receives the orientation-neutral direction, the originating keyboard event, and the key that hit the boundary.",
    },
    {
      name: "defaultHighlighted",
      type: "string | null",
      required: false,
      description: "Initial highlighted value in uncontrolled mode.",
      defaultValue: "null",
    },
    {
      name: "upKeys",
      type: "string[]",
      required: false,
      description: "Custom key names to move highlight up/left.",
    },
    {
      name: "downKeys",
      type: "string[]",
      required: false,
      description: "Custom key names to move highlight down/right.",
    },
    {
      name: "orientation",
      type: '"vertical" | "horizontal"',
      required: false,
      description: "Navigation axis.",
      defaultValue: '"vertical"',
    },
    {
      name: "skipDisabled",
      type: "boolean",
      required: false,
      description:
        'Skip items with aria-disabled="true", data-disabled, or native disabled during navigation.',
      defaultValue: "true",
    },
    {
      name: "moveFocus",
      type: "boolean",
      required: false,
      description: "Move DOM focus to the next item instead of only updating highlight state.",
      defaultValue: "false",
    },
    {
      name: "scopeToContainer",
      type: "boolean",
      required: false,
      description:
        "Ignore items owned by nested collection containers such as nested radiogroups, listboxes, menus, or tablists.",
      defaultValue: "true",
    },
    {
      name: "ownerSelector",
      type: "string | null",
      required: false,
      description:
        "Advanced owner selector override for scoping roles that do not have a standard composite owner.",
    },
    {
      name: "scope",
      type: "string | null",
      required: false,
      description:
        "Keyboard scope name to register navigation handlers under. Pass null to skip registration while a conditional scope is disabled.",
    },
    {
      name: "focusWithinOnly",
      type: "boolean",
      required: false,
      description: "Only handle navigation keys when focus is within the container element.",
      defaultValue: "false",
    },
  ],
  returns: {
    type: "UseScopedNavigationReturn",
    description:
      "Object with highlight state. No onKeyDown — keys are registered via the provider.",
    properties: [
      {
        name: "highlighted",
        type: "string | null",
        required: true,
        description: "The value of the currently highlighted item, or null.",
      },
      {
        name: "isHighlighted",
        type: "(value: string) => boolean",
        required: true,
        description: "Returns true if the given value is the highlighted item.",
      },
      {
        name: "highlight",
        type: "(value: string | null) => void",
        required: true,
        description: "Imperatively set the highlighted item. Pass null to clear.",
      },
    ],
  },
  notes: [
    {
      title: "Requires KeyboardProvider",
      content:
        "useScopedNavigation registers keys through the KeyboardProvider context. It must be used within a <KeyboardProvider> tree.",
    },
    {
      title: "Scope-aware",
      content:
        "Navigation bindings respect the scope stack. If a deeper scope is active, this hook's bindings are suppressed.",
    },
    {
      title: "No onKeyDown needed",
      content:
        "Unlike useNavigation, you do not need to wire up an onKeyDown handler. The provider handles key dispatch.",
    },
  ],
  examples: [
    {
      name: "use-scoped-navigation-basic",
      title: "Scoped navigation in a menu",
    },
    {
      name: "use-scoped-navigation-focus-within",
      title: "Two lists with focusWithinOnly",
    },
  ],
  tags: ["provider-dependent", "navigation", "scope"],
};
