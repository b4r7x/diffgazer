import type { HookDoc } from "@diffgazer/registry"

export const useScopeDoc: HookDoc = {
  description:
    "Push a named scope onto the keyboard scope stack. Handlers in deeper scopes take priority. Auto-pops on unmount.",
  usage: {
    code: `useScope("modal")`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "name",
      type: "string",
      required: true,
      description: "Unique name for the scope pushed onto the stack.",
    },
    {
      name: "options.enabled",
      type: "boolean",
      required: false,
      description: "Whether the scope is active. When false the scope is not pushed.",
      defaultValue: "true",
    },
  ],
  returns: {
    type: "void",
    description: "This hook does not return a value.",
  },
  notes: [
    {
      title: "Scope stack lifecycle",
      content:
        "The scope is pushed when the component mounts (or when enabled becomes true) and automatically popped when the component unmounts (or when enabled becomes false).",
    },
    {
      title: "Requires KeyboardProvider",
      content:
        "useScope is a provider-dependent hook. It must be used within a <KeyboardProvider> tree.",
    },
  ],
  examples: [{ name: "use-scope-basic", title: "Basic scope usage" }],
  tags: ["provider-dependent", "scope"],
}
