import type { HookDoc } from "@diffgazer/registry"

export const useScopeDoc: HookDoc = {
  description:
    "Push a named scope onto the keyboard scope stack. Declarative scopes follow React tree order, so nested overlays can capture shortcuts until they unmount. Auto-pops on unmount.",
  usage: {
    code: `useScope("modal")`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "name",
      type: "string | null",
      required: true,
      description: "Unique name for the scope pushed onto the stack. Pass null to skip pushing without violating Hook call order.",
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
    type: "string | null",
    description: "The active scope name when enabled and non-null, otherwise null.",
  },
  notes: [
    {
      title: "Scope stack lifecycle",
      content:
        "The scope is pushed when the component mounts (or when enabled becomes true and name is non-null) and automatically popped when the component unmounts, when enabled becomes false, or when name becomes null.",
    },
    {
      title: "Active scope ordering",
      content:
        "Declarative scopes pushed by useScope are ordered by their React-generated component identity, which keeps siblings and nested overlays deterministic across a single commit. Imperative pushScope calls are ordered above declarative scopes until popped.",
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
