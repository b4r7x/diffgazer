import type { HookDoc } from "@diffgazer/registry"

export const outsideClickDoc: HookDoc = {
  description: "Detect clicks outside a referenced element. Useful for closing dropdowns, popovers, and modals when the user clicks elsewhere.",
  usage: {
    code: `const ref = useRef<HTMLDivElement>(null);
useOutsideClick(ref, () => setOpen(false));`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "ref",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description: "Ref to the element that defines the 'inside' boundary. Clicks outside this element trigger the handler.",
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
      description: "Whether the listener is active. Defaults to true. Set to false to temporarily disable detection.",
      defaultValue: "true",
    },
    {
      name: "excludeRefs",
      type: "ReadonlyArray<RefObject<HTMLElement | null>>",
      required: false,
      description: "Additional refs to exclude from outside-click detection. Clicks on elements within these refs will not trigger the handler. Useful for excluding trigger elements when content renders in a portal.",
    },
  ],
  returns: {
    type: "void",
    description: "This hook does not return a value. It attaches and cleans up a mousedown event listener.",
    properties: [],
  },
  notes: [
    {
      title: "Event Type",
      content: "Uses mousedown (not click) to detect outside interactions before the click completes. This prevents edge cases where the target element is removed before the click event fires.",
    },
    {
      title: "Used By",
      content: "Built into PopoverContent for dismiss-on-outside-click behavior.",
    },
  ],
  examples: [
    { name: "outside-click-basic", title: "Dismiss Panel" },
  ],
  tags: ["hook", "click", "outside", "dismiss"],
}
