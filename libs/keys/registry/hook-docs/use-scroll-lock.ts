import type { HookDoc } from "@diffgazer/registry"

export const useScrollLockDoc: HookDoc = {
  description:
    "Prevent body or element scrolling with reference counting. Multiple locks on the same element stack safely.",
  usage: {
    code: `useScrollLock()`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "target",
      type: "RefObject<HTMLElement | null>",
      required: false,
      description:
        "Ref to the element to lock. Defaults to document.body when omitted.",
    },
    {
      name: "enabled",
      type: "boolean",
      required: false,
      description: "Whether the scroll lock is active.",
      defaultValue: "true",
    },
  ],
  returns: {
    type: "void",
    description: "This hook does not return a value.",
  },
  notes: [
    {
      title: "Reference counting",
      content:
        "Multiple useScrollLock calls on the same element increment a shared counter. Scrolling is only restored when all locks are released, preventing double-unlock bugs.",
    },
    {
      title: "Standalone",
      content:
        "useScrollLock does not require KeyboardProvider. It works independently as a copy-paste utility hook.",
    },
  ],
  examples: [
    { name: "use-scroll-lock-basic", title: "Lock body scroll in a modal" },
  ],
  tags: ["standalone", "scroll", "utility"],
}
