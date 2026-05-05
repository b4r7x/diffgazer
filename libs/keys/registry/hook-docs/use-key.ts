import type { HookDoc } from "@diffgazer/registry"

export const useKeyDoc: HookDoc = {
  description:
    "Bind keyboard shortcuts to handlers with scoped, document-level, or element-targeted listening. Supports single key, array of keys, or key map overloads.",
  usage: {
    code: `useKey("Escape", () => setOpen(false))`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "hotkey",
      type: "string | readonly string[] | Record<string, KeyHandler>",
      required: true,
      description:
        "A single key combo, an array of key combos, or a map of key combos to handlers.",
    },
    {
      name: "handler",
      type: "KeyHandler",
      required: false,
      description:
        "Callback invoked when the hotkey fires. Not used with the key-map overload.",
    },
    {
      name: "options.enabled",
      type: "boolean",
      required: false,
      description: "Whether the binding is active.",
      defaultValue: "true",
    },
    {
      name: "options.allowInInput",
      type: "boolean",
      required: false,
      description:
        "Allow the hotkey to fire when an input, textarea, or contenteditable element is focused.",
      defaultValue: "false",
    },
    {
      name: "options.targetRef",
      type: "RefObject<HTMLElement | null>",
      required: false,
      description:
        "Scope listening to a specific DOM element instead of the document.",
    },
    {
      name: "options.requireFocusWithin",
      type: "boolean",
      required: false,
      description:
        "Only fire the handler when focus is within the target element.",
      defaultValue: "false",
    },
    {
      name: "options.preventDefault",
      type: "boolean",
      required: false,
      description: "Call preventDefault() on the keyboard event when the hotkey matches.",
      defaultValue: "false",
    },
  ],
  returns: {
    type: "void",
    description: "This hook does not return a value.",
  },
  notes: [
    {
      title: "Three overloads",
      content:
        "useKey supports three call signatures: single key + handler, array of keys + handler, and a Record<string, KeyHandler> map (no separate handler argument).",
    },
    {
      title: "Requires KeyboardProvider",
      content:
        "useKey is a provider-dependent hook. Wrap your component tree with <KeyboardProvider> before using it.",
    },
    {
      title: "Scope-aware",
      content:
        "Handlers respect the scope stack managed by useScope. Deeper scopes take priority over shallower ones.",
    },
  ],
  examples: [
    { name: "use-key-basic", title: "Basic hotkey binding" },
    { name: "use-key-map", title: "Key map with multiple bindings" },
  ],
  tags: ["provider-dependent", "hotkey", "keyboard"],
}
