import type { HookDoc } from "@diffgazer/registry";

export const useActionRowNavigationDoc: HookDoc = {
  description:
    "Provider-backed two-zone keyboard navigation for rows with inline actions. Moves between row content and action buttons while preserving disabled-action behavior.",
  usage: {
    code: [
      `const containerRef = useRef<HTMLDivElement>(null)`,
      ``,
      `const row = useActionRowNavigation({`,
      `  enabled: true,`,
      `  actionCount: 3,`,
      `  containerRef,`,
      `  onAction: (index) => runAction(index),`,
      `})`,
      ``,
      `return <div ref={containerRef}>{/* row content and actions */}</div>`,
    ].join("\n"),
    lang: "tsx",
  },
  parameters: [
    {
      name: "enabled",
      type: "boolean",
      required: true,
      description: "Enables row keyboard handling. Pass the row's active/selected state.",
    },
    {
      name: "actionCount",
      type: "number",
      required: true,
      description: "Number of action controls managed by the row.",
    },
    {
      name: "onAction",
      type: "(index: number) => void",
      required: true,
      description: "Called when Enter or Space activates the focused action.",
    },
    {
      name: "disabledActions",
      type: "readonly boolean[]",
      required: false,
      description:
        "Per-index disabled flags. Disabled actions are skipped during navigation and ignored on activation.",
    },
    {
      name: "disabledFocusFallbackRef",
      type: "RefObject<HTMLElement | null>",
      required: false,
      description:
        "Receives focus when entering the actions zone but no action is enabled. Falls back to blurring the focused action when omitted.",
    },
    {
      name: "containerRef",
      type: "RefObject<HTMLElement | null>",
      required: false,
      description:
        "When supplied, limits zone handling to one row subtree so sibling rows do not respond to the same key press. Omit it only when the active row should keep global keyboard ownership within its scope.",
    },
    {
      name: "allowInInput",
      type: "boolean",
      required: false,
      description: "Allow row shortcuts to run when an editable element is focused.",
      defaultValue: "false",
    },
    {
      name: "wrap",
      type: "boolean",
      required: false,
      description: "Wrap ArrowLeft/ArrowRight movement across the action ends.",
      defaultValue: "false",
    },
    {
      name: "defaultZone",
      type: '"content" | "actions"',
      required: false,
      description:
        "Initial zone. When set to actions, the hook focuses the default action on mount.",
      defaultValue: '"content"',
    },
    {
      name: "defaultIndex",
      type: "number",
      required: false,
      description: "Initial action index focused when entering the actions zone.",
      defaultValue: "0",
    },
    {
      name: "canExitActions",
      type: "boolean",
      required: false,
      description: "Allow ArrowUp to leave the actions zone back to content.",
      defaultValue: "true",
    },
    {
      name: "onNavigate",
      type: "(index: number) => void",
      required: false,
      description:
        "Called when navigation lands on an action index, including when entering the actions zone.",
    },
    {
      name: "onNavigationBoundaryReached",
      type: '(direction: "previous" | "next") => void',
      required: false,
      description:
        "Called when navigation cannot move further: previous when exiting actions or hitting the left edge with wrap off, next when hitting the right edge.",
    },
  ],
  returns: {
    type: "UseActionRowNavigationReturn",
    description:
      "Zone state plus imperative controls and a getActionProps factory to wire each action element.",
    properties: [
      {
        name: "inActions",
        type: "boolean",
        required: true,
        description: "Whether the row is currently in the actions zone.",
      },
      {
        name: "focusedIndex",
        type: "number",
        required: true,
        description: "Current focused action index.",
      },
      {
        name: "isFocusedActionDisabled",
        type: "boolean",
        required: true,
        description: "Whether the current action index is disabled.",
      },
      {
        name: "enterActions",
        type: "(index?: number) => number | null",
        required: true,
        description:
          "Moves into the actions zone and focuses the requested or first enabled action. Returns the focused index, or null when no action is enabled.",
      },
      {
        name: "exitActions",
        type: "() => void",
        required: true,
        description: "Returns to the content zone when canExitActions is true.",
      },
      {
        name: "reset",
        type: "(initialIndex?: number) => void",
        required: true,
        description: "Returns to content and resets the focused action index.",
      },
      {
        name: "getActionProps",
        type: '(index: number) => { ref: RefCallback<HTMLElement>; "data-action-index": number; onFocus: () => void }',
        required: true,
        description: "Props to spread onto each action element so the hook can focus and track it.",
      },
    ],
  },
  notes: [
    {
      title: "Two zones, one row",
      content:
        "The hook composes useFocusZone with a content zone and an actions zone. ArrowDown enters actions from content, ArrowUp leaves actions, and ArrowLeft/ArrowRight move between actions.",
    },
    {
      title: "Disabled actions",
      content:
        "Indexes flagged in disabledActions are skipped during ArrowLeft/ArrowRight movement and ignored by Enter/Space. If every action is disabled, the hook returns to content and focuses disabledFocusFallbackRef.",
    },
    {
      title: "Scope rows with containerRef",
      content:
        "Pass containerRef for each row so its arrow keys only fire while focus is inside that row. Omitting it intentionally leaves the active row's handlers global within the current keyboard scope.",
    },
    {
      title: "Requires KeyboardProvider",
      content:
        "useActionRowNavigation registers keys through useKey and useFocusZone, so it must be used within a <KeyboardProvider> tree. It is package-only.",
    },
  ],
  examples: [{ name: "use-action-row-navigation-basic", title: "Review row with inline actions" }],
  tags: ["provider-dependent", "navigation", "actions", "row"],
};
