import type { ComponentDoc } from "./types";

export const progressDoc: ComponentDoc = {
  description:
    "Horizontal progress bar with determinate and indeterminate modes. Uses native progressbar ARIA with value clamping and a terminal-inspired sliding animation for indeterminate state.",
  anatomy: [
    {
      name: "Progress",
      indent: 0,
      note: "Root element with track and fill. Pass value for determinate, omit for indeterminate.",
    },
  ],
  notes: [
    {
      title: "Indeterminate Mode",
      content:
        "When value is undefined, the bar enters indeterminate mode with a sliding fill animation. The aria-valuenow attribute is omitted per WAI-ARIA spec.",
    },
    {
      title: "Value Clamping",
      content:
        "The value is clamped between 0 and max. Values outside this range are silently corrected.",
    },
    {
      title: "Reduced Motion",
      content:
        "The indeterminate animation respects prefers-reduced-motion: reduce. When active, the bar renders a static 40% fill.",
    },
  ],
  usage: { example: "progress-default" },
  examples: [{ name: "progress-default", title: "Default" }],
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "Progress",
      values: '"loaded" | "indeterminate"',
      description: "Determinate/indeterminate state for track and indicator styling.",
    },
  ],
  props: {
    Progress: {
      value: {
        type: "number",
        required: false,
        defaultValue: null,
        description: "Current progress value (0-100). Omit for indeterminate mode.",
      },
      max: {
        type: "number",
        required: false,
        defaultValue: "100",
        description: "Maximum value for the progress bar.",
      },
      size: {
        type: '"sm" | "md"',
        required: false,
        defaultValue: '"md"',
        description: "Height of the progress bar track.",
      },
    },
  },
};
