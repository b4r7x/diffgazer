import type { ComponentDoc } from "./types";

export const iconsDoc: ComponentDoc = {
  description: "SVG icon components for use as indicators, triggers, and decorative elements.",
  anatomy: [
    {
      name: "Chevron",
      indent: 0,
      note: "Directional SVG icon with rotation animation and size variants",
    },
  ],
  notes: [
    {
      title: "Animation",
      content:
        "Set open={true} to rotate the chevron 90° clockwise from its base direction. Uses CSS transition-transform for smooth animation.",
    },
    {
      title: "Accessibility",
      content:
        'Chevron defaults to `aria-hidden="true"` for decorative use. For a meaningful standalone icon, set `aria-hidden={false}`, `role="img"`, and an accessible name such as `aria-label`.',
    },
    {
      title: "Reusability",
      content:
        "Chevron is used as the default trigger indicator by Accordion, Select, and Sidebar. Installing any of these components auto-installs Icons via registryDependencies. Each supports a handle prop to customize or hide it.",
    },
  ],
  usage: { example: "chevron-default" },
  examples: [
    { name: "chevron-default", title: "Default Chevron" },
    { name: "chevron-directions", title: "All Directions" },
    { name: "chevron-animated", title: "Animated Toggle" },
  ],
  keyboard: null,
  props: {
    Chevron: {
      direction: {
        type: '"down" | "up" | "left" | "right"',
        required: false,
        defaultValue: '"right"',
        description: "Base direction the chevron points before any rotation.",
      },
      open: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Rotates 90 degrees clockwise from the base direction. Use for expand/collapse toggles.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"sm"',
        description: "Icon size token.",
      },
    },
  },
};
