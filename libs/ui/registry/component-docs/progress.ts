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
        "The value is clamped between 0 and max. Values outside this range are silently corrected. A NaN value is normalized to 0 before clamping. A non-finite, zero, or negative max is normalized to the default of 100 before ARIA values and fill width are calculated.",
    },
    {
      title: "Reduced Motion",
      content:
        "The indeterminate animation respects prefers-reduced-motion: reduce. When active, the bar renders a static 40% fill.",
    },
    {
      title: "Progress vs BlockBar",
      content:
        "Progress is the pixel bar for task completion: role=progressbar, a solid fill, and an indeterminate mode for work with no known duration. BlockBar is the character-cell meter for a steady-state measurement (role=meter) — coverage, token budget, severity mix — drawn from filled/empty glyphs and stackable into colored segments. Reach for Progress when something is running, BlockBar when something is being measured.",
    },
  ],
  usage: { example: "progress-default" },
  examples: [
    { name: "progress-default", title: "Default" },
    { name: "progress-sizes", title: "Sizes" },
    { name: "progress-labeled", title: "Labeled with value text" },
  ],
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
        description:
          "Finite positive maximum for the progress bar. Invalid values are normalized to 100.",
      },
      size: {
        type: '"sm" | "md"',
        required: false,
        defaultValue: '"md"',
        description: "Height of the progress bar track.",
      },
      valueText: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Custom text exposed through aria-valuetext for the current value.",
      },
    },
  },
};
