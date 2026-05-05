import type { ComponentDoc } from "./types"

export const overflowDetectionDoc: ComponentDoc = {
  description: "Detects whether an element's content overflows its container. Uses ResizeObserver for reactive updates — no polling, no manual recalculation.",
  notes: [
    {
      title: "Direction",
      content: "Supports \"horizontal\" (default — checks scrollWidth > clientWidth), \"vertical\" (checks scrollHeight > clientHeight), and \"both\" (either axis).",
    },
    {
      title: "Usage Pattern",
      content: "Attach the returned ref to the element with constrained dimensions (e.g. truncated text, fixed-width container). The isOverflowing boolean updates reactively as the element resizes.",
    },
    {
      title: "Common Use Cases",
      content: "Conditionally showing tooltips on truncated text, toggling expand/collapse buttons, applying visual indicators when content is clipped.",
    },
  ],
  usage: {
    code: `const { ref, isOverflowing } = useOverflow("horizontal");

return (
  <div ref={ref} className="truncate">
    {isOverflowing && <Tooltip content={text}>{text}</Tooltip>}
  </div>
);`,
    lang: "tsx",
  },
  tags: ["hook", "overflow", "resize-observer", "detection"],
}
