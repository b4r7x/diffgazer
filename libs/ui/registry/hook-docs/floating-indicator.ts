import type { HookDoc } from "@diffgazer/registry";

export const floatingIndicatorDoc: HookDoc = {
  description:
    "Measures the active child inside a container and returns a container-relative rectangle for drawing a floating indicator under or around it.",
  usage: {
    code: `const containerRef = useRef<HTMLDivElement>(null);
const indicator = useFloatingIndicator(containerRef, activeValue);

return (
  <div ref={containerRef} className="relative">
    {items.map((item) => (
      <button key={item.value} data-value={item.value}>
        {item.label}
      </button>
    ))}
    {indicator && (
      <span
        aria-hidden="true"
        style={{
          left: indicator.left,
          top: indicator.top,
          width: indicator.width,
          height: indicator.height,
        }}
      />
    )}
  </div>
);`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "containerRef",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description:
        "Ref for the positioned container that owns selectable descendants marked with data-value.",
    },
    {
      name: "activeValue",
      type: "string | null",
      required: true,
      description:
        'Active item value. The hook queries [data-value="..."] inside containerRef and returns null when no matching item is mounted.',
    },
  ],
  returns: {
    type: "FloatingIndicatorRect | null",
    description:
      "Container-relative rectangle for the active item, or null before measurement / when no active item exists.",
    properties: [
      {
        name: "left",
        type: "number",
        required: true,
        description: "Left offset from the container's bounding box.",
      },
      {
        name: "top",
        type: "number",
        required: true,
        description: "Top offset from the container's bounding box.",
      },
      {
        name: "width",
        type: "number",
        required: true,
        description: "Measured active item width.",
      },
      {
        name: "height",
        type: "number",
        required: true,
        description: "Measured active item height.",
      },
    ],
  },
  notes: [
    {
      title: "Measurement",
      content:
        "The rectangle is measured with getBoundingClientRect relative to the container. ResizeObserver and MutationObserver keep it current when layout or children change.",
    },
    {
      title: "Selector Contract",
      content:
        "Items must expose data-value matching activeValue. Values are escaped before building the selector, so special characters in values are supported by modern browsers.",
    },
  ],
  tags: ["hook", "indicator", "measurement"],
};
