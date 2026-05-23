import type { HookDoc } from "@diffgazer/registry"

export const useFocusRestoreDoc: HookDoc = {
  description:
    "Capture and restore focus around overlays, panels, command palettes, and triggerless temporary UI with nested stack safety.",
  usage: {
    code: `const focusRestore = useFocusRestore()`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "options.enabled",
      type: "boolean",
      required: false,
      description: "Whether capture and restore are active.",
      defaultValue: "true",
    },
    {
      name: "options.restoreOnUnmount",
      type: "boolean",
      required: false,
      description:
        "Restore focus during cleanup if capture was called and restore was not called manually.",
      defaultValue: "true",
    },
    {
      name: "options.preventScroll",
      type: "boolean",
      required: false,
      description: "Pass preventScroll to the focus call when restoring focus.",
      defaultValue: "false",
    },
    {
      name: "options.fallback",
      type: "HTMLElement | null",
      required: false,
      description:
        "Fallback element to focus when the captured target is unavailable.",
      defaultValue: "null",
    },
  ],
  returns: {
    type: "{ capture: (ownerDocument?: Document) => HTMLElement | null; restore: () => boolean; target: HTMLElement | null }",
    description:
      "capture stores the current focus target, restore focuses the captured or fallback target, and target exposes the last captured element.",
  },
  notes: [
    {
      title: "Hook boundary",
      content:
        "useFocusRestore is the React hook. getRestorableFocusTarget and restoreFocus are plain DOM utilities for non-hook code.",
    },
    {
      title: "Nested overlays",
      content:
        "Focus restore entries are stack-aware, so nested overlays restore focus in close order and older layers do not steal focus from newer ones.",
    },
  ],
  examples: [
    { name: "use-focus-restore-basic", title: "Temporary panel focus restore" },
  ],
  tags: ["standalone", "focus", "accessibility", "overlay"],
}
