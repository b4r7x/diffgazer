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
        "Pulse defaults to true for online status only. Set pulse={false} to disable animation. Honors prefers-reduced-motion via motion-reduce:animate-none.",
    },
    {
      title: "Status colors",
      content:
        "status='online' uses primary, 'offline' uses muted-foreground, and 'busy' uses warning.",
    },
  ],
  usage: { example: "status-indicator-default" },
  examples: [],
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
        defaultValue: "true (online only)",
        description: "Animate the dot. Online status pulses by default when true.",
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
