import type { HookDoc } from "@diffgazer/registry"

export const presenceDoc: HookDoc = {
  description:
    "Hook for animating mount/unmount transitions with CSS animations — keeps element in DOM during exit animation, removes after completion.",
  usage: {
    code: `const { present, onAnimationEnd } = usePresence({ open });

return present ? (
  <div
    data-state={open ? "open" : "closed"}
    onAnimationEnd={onAnimationEnd}
  >
    {children}
  </div>
) : null;`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "open",
      type: "boolean",
      required: true,
      description:
        "Whether the content should be visible. When true, mounts immediately. When false, keeps mounted until exit animation completes via onAnimationEnd.",
    },
    {
      name: "ref",
      type: "RefObject<HTMLElement | null>",
      required: false,
      description:
        "Ref to the animated element. When provided, filters bubbling animationend events from child elements. Recommended when the animated element has children with their own CSS animations.",
    },
  ],
  returns: {
    type: "{ present: boolean; exiting: boolean; onAnimationEnd: (e: AnimationEvent) => void }",
    description:
      "Object with present flag for conditional rendering and onAnimationEnd callback for the animated element.",
    properties: [
      {
        name: "present",
        type: "boolean",
        required: true,
        description:
          "Whether the element should be in the DOM. Use this for conditional rendering.",
      },
      {
        name: "exiting",
        type: "boolean",
        required: true,
        description:
          "True during the closing animation phase, after present becomes false but before onAnimationEnd is called.",
      },
      {
        name: "onAnimationEnd",
        type: "(e: AnimationEvent) => void",
        required: true,
        description:
          "Callback to attach to the animated element's onAnimationEnd. Filters bubbling events from children — only reacts to animations on the ref element itself.",
      },
    ],
  },
  notes: [
    {
      title: "State machine",
      content:
        "Uses a three-phase state machine (hidden → open → closing → hidden). Phase transitions happen synchronously during render to ensure the element is in the DOM before any useLayoutEffect runs in child components.",
    },
    {
      title: "CSS animation pattern",
      content:
        "Pair with data-state attribute and CSS @keyframes. Set data-state=\"open\"|\"closed\" and use data-[state=open]:animate-[...] / data-[state=closed]:animate-[...] for enter/exit animations.",
    },
    {
      title: "Used by",
      content:
        "Built into DialogShell (shared by DialogContent and CommandPaletteContent) and PopoverContent. Tooltip gets animation via PopoverContent delegation.",
    },
  ],
  examples: [
    { name: "use-presence-basic", title: "Basic Toggle" },
    { name: "use-presence-tooltip", title: "Tooltip Hover" },
  ],
  tags: ["hook", "animation", "mount", "unmount", "presence"],
}
