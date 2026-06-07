import type { HookDoc } from "@diffgazer/registry";

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
      type: '"radio" | "checkbox" | "option" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "button" | "tab"',
      required: true,
      description: "ARIA role used to query navigable children within the container.",
    },
    {
      name: "highlighted",
      type: "string | null",
      required: false,
      description:
        "Controlled highlight value. When provided, the hook operates in controlled mode.",
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
      description:
        "Navigation axis. Vertical uses ArrowUp/ArrowDown, horizontal uses ArrowLeft/ArrowRight.",
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
  ],
  returns: {
    type: "UseNavigationReturn",
    description: "Object with highlight state and an onKeyDown handler to attach to the container.",
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
      {
        name: "onKeyDown",
        type: "(event: KeyboardEvent) => void",
        required: true,
        description: "Keyboard event handler to attach to the container element.",
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
        "Navigable items are queried from the DOM using the specified role or the data-diffgazer-navigation-item data contract. Items must have a data-value attribute.",
    },
    {
      title: "Nested collections",
      content:
        "scopeToContainer is enabled by default so items inside a nested owner container are excluded from the parent navigation order.",
    },
    {
      title: "Controlled and uncontrolled",
      content:
        "Pass highlighted + onHighlightChange for controlled mode, or use defaultHighlighted for uncontrolled mode.",
    },
  ],
  examples: [
    { name: "use-navigation-basic", title: "Basic list navigation" },
    { name: "use-navigation-tabs", title: "Horizontal tab navigation" },
  ],
  tags: ["standalone", "navigation", "list"],
};
