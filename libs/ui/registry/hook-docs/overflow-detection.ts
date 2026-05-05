import type { HookDoc } from "@diffgazer/registry"

export const overflowDetectionDoc: HookDoc = {
  description:
    "Detects whether an element's content overflows its container using ResizeObserver. Returns a ref to attach and a reactive boolean — no polling, no manual recalculation.",
  usage: {
    code: `const { ref, isOverflowing } = useOverflow("horizontal");

return (
  <div ref={ref} className="truncate">
    {text}
    {isOverflowing && <span>…</span>}
  </div>
);`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "direction",
      type: '"horizontal" | "vertical" | "both"',
      required: false,
      description:
        'Which axis to check for overflow. "horizontal" compares scrollWidth > clientWidth, "vertical" compares scrollHeight > clientHeight, "both" checks either. Defaults to "horizontal".',
    },
  ],
  returns: {
    type: "{ ref: RefObject<T | null>; isOverflowing: boolean }",
    description:
      "A ref to attach to the observed element, and a boolean that updates reactively when overflow state changes.",
    properties: [
      {
        name: "ref",
        type: "RefObject<T | null>",
        required: true,
        description:
          "Attach to the element whose overflow you want to detect. Must have constrained dimensions (width/height).",
      },
      {
        name: "isOverflowing",
        type: "boolean",
        required: true,
        description:
          "True when content exceeds container bounds in the specified direction.",
      },
    ],
  },
  notes: [
    {
      title: "Common Use Cases",
      content:
        "Conditionally showing tooltips on truncated text, toggling expand/collapse buttons, applying visual indicators when content is clipped.",
    },
    {
      title: "Requirement",
      content:
        "The ref'd element must have constrained dimensions. For horizontal detection, the element needs a width constraint (e.g. truncate, max-w-*, fixed width). For vertical, it needs a height constraint.",
    },
  ],
  examples: [
    { name: "overflow-detection-basic", title: "Basic Detection" },
  ],
  tags: ["hook", "overflow", "resize-observer", "detection"],
}
