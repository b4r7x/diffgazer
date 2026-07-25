import type { ComponentDoc } from "./types";

export const statusIndicatorDoc: ComponentDoc = {
  description:
    "Compact status readout with a shape-coded status marker and uppercase label. Renders role=status for assistive technologies.",
  anatomy: [
    {
      name: "StatusIndicator",
      indent: 0,
      note: "Inline status row: pulsing status marker (optional) plus children label text.",
    },
  ],
  notes: [
    {
      title: "Pulse",
      content:
        "Pulse defaults to true, but the dot only animates when status='online' (a compound variant in statusIndicatorDotVariants). Set pulse={false} to disable animation. Honors prefers-reduced-motion via motion-reduce:animate-none.",
    },
    {
      title: "Shape and color",
      content:
        "Every status carries its own marker shape so the states stay apart without relying on hue: online is a filled circle (success), busy is a filled square (warning), offline is a hollow circle (muted-foreground). The shape also keeps online readable mid-pulse, when its opacity dips toward the offline tone.",
    },
    {
      title: "Accessible status word",
      content:
        "The marker is decorative (aria-hidden), so the root renders an sr-only status word (defaulting to the status value) for screen-reader users. Override the word with the label prop, or pass label={null} to suppress it when the visible children already state the status.",
    },
    {
      title: "Live region",
      content:
        'The root renders role="status" — an implicit polite live region — so screen readers announce label changes without interrupting.',
    },
  ],
  usage: { example: "status-indicator-default" },
  examples: [
    { name: "status-indicator-default", title: "Default" },
    { name: "status-indicator-inline", title: "Inline in a panel header and rows" },
  ],
  keyboard: null,
  props: {
    StatusIndicator: {
      status: {
        type: '"online" | "offline" | "busy"',
        required: false,
        defaultValue: '"online"',
        description:
          "Semantic status. Drives the dot shape and color and the default sr-only status word.",
      },
      pulse: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          "Animate the dot. Only the online status animates; busy and offline never pulse.",
      },
      label: {
        type: "string | null",
        required: false,
        defaultValue: "the status value",
        description:
          "Screen-reader status word announced beside the color-only dot. Defaults to the status value; pass null to suppress it when the children already state the status.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Uppercase label text shown beside the dot.",
      },
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Additional classes on the root status element.",
      },
    },
  },
};
