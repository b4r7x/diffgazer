import type { HookDoc } from "@diffgazer/registry"

export const floatingPositionDoc: HookDoc = {
  description:
    "Position floating content relative to a trigger element. Handles collision detection, auto-flipping to opposite sides, and viewport boundary shifting.",
  usage: {
    code: `const triggerRef = useRef<HTMLButtonElement>(null);
const { position, contentRef } = useFloatingPosition({
  triggerRef,
  open,
  side: "bottom",
  align: "center",
});`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "triggerRef",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description:
        "Ref to the trigger element that the floating content is positioned relative to.",
    },
    {
      name: "open",
      type: "boolean",
      required: true,
      description:
        "Whether the floating content is open. Position is computed when true, reset to null when false.",
    },
    {
      name: "side",
      type: '"top" | "bottom" | "left" | "right"',
      required: false,
      description:
        "Preferred side for positioning. Auto-flips if there isn't enough space.",
      defaultValue: '"top"',
    },
    {
      name: "align",
      type: '"start" | "center" | "end"',
      required: false,
      description: "Alignment along the cross axis.",
      defaultValue: '"center"',
    },
    {
      name: "sideOffset",
      type: "number",
      required: false,
      description:
        "Distance in pixels between the trigger and floating content along the side axis.",
      defaultValue: "6",
    },
    {
      name: "alignOffset",
      type: "number",
      required: false,
      description: "Offset in pixels along the alignment axis.",
      defaultValue: "0",
    },
    {
      name: "collisionPadding",
      type: "number",
      required: false,
      description:
        "Minimum distance in pixels from viewport edges when avoiding collisions.",
      defaultValue: "8",
    },
    {
      name: "avoidCollisions",
      type: "boolean",
      required: false,
      description:
        "Whether to automatically flip sides and shift position to stay within viewport.",
      defaultValue: "true",
    },
  ],
  returns: {
    type: "UseFloatingPositionReturn",
    description:
      "Object containing computed position and a ref for the floating content element.",
    properties: [
      {
        name: "position",
        type: "FloatingPosition | null",
        required: true,
        description:
          "Computed position with x, y coordinates and resolved side/align. Null when closed.",
      },
      {
        name: "contentRef",
        type: "RefObject<HTMLDivElement | null>",
        required: true,
        description:
          "Ref to attach to the floating content element. Used for measuring dimensions during positioning.",
      },
    ],
  },
  notes: [
    {
      title: "Collision Detection",
      content:
        "When content would overflow the viewport, the hook tries the opposite side first, then cross-axis sides, and finally shifts the position to stay within bounds.",
    },
    {
      title: "Layout Effect",
      content:
        "Uses useLayoutEffect to compute position synchronously before paint, preventing visual flicker.",
    },
    {
      title: "Used By",
      content:
        "Built into PopoverContent for automatic positioning of popovers and tooltips.",
    },
  ],
  examples: [
    { name: "floating-position-basic", title: "Basic Positioning" },
  ],
  tags: ["hook", "positioning", "floating", "popover", "tooltip"],
}
