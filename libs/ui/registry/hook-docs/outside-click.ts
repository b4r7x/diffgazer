import type { HookDoc } from "@diffgazer/registry";

export const outsideClickDoc: HookDoc = {
  description:
    "Detect clicks outside a referenced element. Useful for closing dropdowns, popovers, and modals when the user clicks elsewhere.",
  usage: {
    code: `const ref = useRef<HTMLDivElement>(null);
const triggerRef = useRef<HTMLButtonElement>(null);
useOutsideClick(ref, () => setOpen(false), open, [triggerRef], { priority: 2 });`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "ref",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description:
        "Ref to the element that defines the 'inside' boundary. Clicks outside this element trigger the handler.",
    },
    {
      name: "handler",
      type: "() => void",
      required: true,
      description: "Called when a click occurs outside the referenced element.",
    },
    {
      name: "enabled",
      type: "boolean",
      required: false,
      description:
        "Whether the listener is active. Defaults to true. Set to false to temporarily disable detection.",
      defaultValue: "true",
    },
    {
      name: "excludeRefs",
      type: "ReadonlyArray<RefObject<HTMLElement | null>>",
      required: false,
      description:
        "Additional refs to exclude from outside-click detection. Clicks on elements within these refs will not trigger the handler. Useful for excluding trigger elements when content renders in a portal.",
    },
    {
      name: "options",
      type: "OverlayStackOptions",
      required: false,
      description:
        "Fifth positional argument. Its priority sets this outside-pointer layer's overlay-stack precedence. The inside boundary remains ref and the fourth excludeRefs argument.",
    },
  ],
  returns: {
    type: "void",
    description:
      "This hook does not return a value. It attaches and cleans up capture-phase pointerdown, with capture-phase touchstart and mousedown fallbacks.",
    properties: [],
  },
  notes: [
    {
      title: "Event Type",
      content:
        "Uses capture-phase pointerdown when available, with capture-phase touchstart and mousedown fallbacks, to detect outside interactions before the click completes.",
    },
    {
      title: "Conditional content",
      content:
        "Pass the same open state as enabled when the referenced element mounts conditionally. The hook reconciles late ref attachment, node replacement, and owner-document changes after each commit.",
    },
    {
      title: "Used By",
      content: "Built into PopoverContent for dismiss-on-outside-click behavior.",
    },
  ],
  examples: [{ name: "outside-click-basic", title: "Dismiss Panel" }],
  tags: ["hook", "click", "outside", "dismiss"],
};
