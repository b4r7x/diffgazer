import type { HookDoc } from "@diffgazer/registry";

export const presenceDoc: HookDoc = {
  description:
    "Hook for animating mount/unmount transitions with CSS animations — keeps element in DOM during exit animation, removes after completion.",
  usage: {
    code: `const ref = useRef<HTMLDivElement>(null);
const { present } = usePresence({ open, ref });

return present ? (
  <div ref={ref} data-state={open ? "open" : "closed"}>
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
        "Whether the content should be visible. When true, mounts immediately. When false, keeps mounted until the exit animation resolves or the fallback timer fires.",
    },
    {
      name: "ref",
      type: "RefObject<HTMLElement | null>",
      required: false,
      description:
        "Ref to the animated element. When provided, filters bubbling animationend events from child elements. Recommended when the animated element has children with their own CSS animations.",
    },
    {
      name: "exitFallbackMs",
      type: "number",
      required: false,
      defaultValue: "250",
      description:
        "Max ms to wait for animationend before forcing the closing -> hidden transition. Raise to at least 2x the exit-animation duration when customizing longer animations.",
    },
    {
      name: "onExitComplete",
      type: "() => void",
      required: false,
      description:
        "Fired after the exit animation resolves, or after exitFallbackMs fires, and the element transitions to hidden.",
    },
  ],
  returns: {
    type: "{ present: boolean; exiting: boolean; onAnimationEnd: (e: AnimationEvent) => void }",
    description:
      "Object with present flag for conditional rendering plus optional React-synthetic-event callbacks. When a ref is supplied the hook attaches its own DOM listeners and most consumers only need `present`.",
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
          "True during the closing animation phase, after present becomes false but before the animation completes.",
      },
      {
        name: "onAnimationEnd",
        type: "(e: AnimationEvent) => void",
        required: true,
        description:
          "React-synthetic onAnimationEnd callback for consumers that do not pass a ref. When a ref is provided this handler is a no-op; the hook's native listener handles completion and filters bubbling child events.",
      },
    ],
  },
  notes: [
    {
      title: "State machine",
      content:
        "Uses a three-phase state machine (hidden → open → closing → hidden). Phase transitions happen synchronously during render so the element is in the DOM before any useLayoutEffect runs in child components.",
    },
    {
      title: "CSS animation pattern",
      content:
        'Pair with data-state attribute and CSS @keyframes. Set data-state="open"|"closed" and use data-[state=open]:animate-[...] / data-[state=closed]:animate-[...] for enter/exit animations.',
    },
    {
      title: "Used by",
      content:
        "Built into FloatingPanel (the shared anchored-surface primitive) and DialogShell. Popover, Select, and Tooltip inherit presence transitions through FloatingPanel; CommandPaletteContent inherits through DialogShell.",
    },
  ],
  examples: [
    { name: "use-presence-basic", title: "Basic Toggle" },
    { name: "use-presence-tooltip", title: "Tooltip Hover" },
  ],
  tags: ["hook", "animation", "mount", "unmount", "presence"],
};
