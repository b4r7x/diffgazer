import type { HookDoc } from "@diffgazer/registry"

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
      type: '"radio" | "checkbox" | "option" | "menuitem" | "button" | "tab"',
      required: true,
      description:
        "ARIA role used to query navigable children within the container.",
    },
    {
      name: "value",
      type: "string | null",
      required: false,
      description: "Controlled highlight value.",
    },
    {
      name: "onValueChange",
      type: "(value: string) => void",
      required: false,
      description: "Called when the selected value changes.",
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
      name: "onHighlightChange",
      type: "(value: string) => void",
      required: false,
      description: "Called whenever the highlighted item changes.",
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
      name: "onBoundaryReached",
      type: '(direction: "up" | "down") => void',
      required: false,
      description:
        "Called when the user tries to navigate past the first or last item.",
    },
    {
      name: "initialValue",
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
      description: "Skip items with aria-disabled=\"true\" during navigation.",
      defaultValue: "true",
    },
    {
      name: "requireFocusWithin",
      type: "boolean",
      required: false,
      description:
        "Only handle navigation keys when focus is within the container element.",
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
        type: "(value: string) => void",
        required: true,
        description: "Imperatively set the highlighted item.",
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
  ],
  tags: ["provider-dependent", "navigation", "scope"],
}
