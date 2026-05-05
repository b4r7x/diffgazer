import type { HookDoc } from "@diffgazer/registry"

export const useNavigationDoc: HookDoc = {
  description:
    "Standalone keyboard navigation for role-based lists. Uses DOM queries to find navigable items. No provider needed.",
  usage: {
    code: [
      `const { highlighted, onKeyDown } = useNavigation({`,
      `  containerRef,`,
      `  role: "option",`,
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
      description:
        "Controlled highlight value. When provided, the hook operates in controlled mode.",
    },
    {
      name: "onValueChange",
      type: "(value: string) => void",
      required: false,
      description: "Called when the selected value changes (radio/checkbox roles).",
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
        "Called when the user tries to navigate past the first or last item (only when wrap is false).",
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
      description:
        "Navigation axis. Vertical uses ArrowUp/ArrowDown, horizontal uses ArrowLeft/ArrowRight.",
      defaultValue: '"vertical"',
    },
    {
      name: "skipDisabled",
      type: "boolean",
      required: false,
      description: "Skip items with aria-disabled=\"true\" during navigation.",
      defaultValue: "true",
    },
  ],
  returns: {
    type: "UseNavigationReturn",
    description:
      "Object with highlight state and an onKeyDown handler to attach to the container.",
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
      {
        name: "onKeyDown",
        type: "(event: KeyboardEvent) => void",
        required: true,
        description:
          "Keyboard event handler to attach to the container element.",
      },
    ],
  },
  notes: [
    {
      title: "Standalone",
      content:
        "useNavigation does not require KeyboardProvider. It works with a direct onKeyDown handler attached to the container.",
    },
    {
      title: "DOM-based item discovery",
      content:
        "Navigable items are queried from the DOM using the specified role attribute. Items must have a data-value attribute.",
    },
    {
      title: "Controlled and uncontrolled",
      content:
        "Pass value + onHighlightChange for controlled mode, or use initialValue for uncontrolled mode.",
    },
  ],
  examples: [
    { name: "use-navigation-basic", title: "Basic list navigation" },
    { name: "use-navigation-tabs", title: "Horizontal tab navigation" },
  ],
  tags: ["standalone", "navigation", "list"],
}
