import type { HookDoc } from "@diffgazer/registry"

export const useFocusTrapDoc: HookDoc = {
  description:
    "Trap Tab/Shift+Tab focus within a container element. Auto-focuses first focusable element on mount, restores focus on unmount.",
  usage: {
    code: `useFocusTrap(containerRef)`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "containerRef",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description:
        "Ref to the container element that traps focus. Passed as the first positional argument.",
    },
    {
      name: "options.initialFocus",
      type: "RefObject<HTMLElement | null>",
      required: false,
      description:
        "Ref to the element that receives focus when the trap activates. Defaults to the first focusable element.",
    },
    {
      name: "options.restoreFocus",
      type: "boolean",
      required: false,
      description:
        "Restore focus to the previously focused element when the trap deactivates.",
      defaultValue: "true",
    },
    {
      name: "options.enabled",
      type: "boolean",
      required: false,
      description: "Whether the focus trap is active.",
      defaultValue: "true",
    },
  ],
  returns: {
    type: "void",
    description: "This hook does not return a value.",
  },
  notes: [
    {
      title: "Standalone",
      content:
        "useFocusTrap does not require KeyboardProvider. It listens for Tab/Shift+Tab directly on the container.",
    },
    {
      title: "Tab wrapping",
      content:
        "When focus reaches the last focusable element, Tab wraps to the first. Shift+Tab from the first wraps to the last.",
    },
  ],
  examples: [
    { name: "use-focus-trap-basic", title: "Modal focus trap" },
  ],
  tags: ["standalone", "focus", "accessibility"],
}
