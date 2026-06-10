import type { ComponentDoc } from "./types";

export const statusIndicatorDoc: ComponentDoc = {
  description:
    "Compact status readout with a colored dot and uppercase label. Renders role=status for assistive technologies.",
  anatomy: [
    {
      name: "StatusIndicator",
      indent: 0,
      note: "Inline status row: pulsing dot (optional) plus children label text.",
    },
  ],
  notes: [
    {
      title: "Pulse",
      content:
        "Pulse defaults to true, but the dot only animates when status='online' (a compound variant in statusIndicatorDotVariants). Set pulse={false} to disable animation. Honors prefers-reduced-motion via motion-reduce:animate-none.",
    },
    {
      title: "Status colors",
      content:
        "status='online' uses primary, 'offline' uses muted-foreground, and 'busy' uses warning.",
    },
    {
      title: "Live region",
      content:
        'The root renders role="status" — an implicit polite live region — so screen readers announce label changes without interrupting.',
    },
  ],
  usage: { example: "status-indicator-default" },
  examples: [{ name: "status-indicator-default", title: "Default" }],
  keyboard: null,
  props: {
    StatusIndicator: {
      status: {
        type: '"online" | "offline" | "busy"',
        required: false,
        defaultValue: '"online"',
        description: "Dot color variant.",
      },
      pulse: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          "Animate the dot. Only the online status animates; busy and offline never pulse.",
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
