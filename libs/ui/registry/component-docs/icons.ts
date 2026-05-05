import type { ComponentDoc } from "./types"

export const iconsDoc: ComponentDoc = {
  description:
    "SVG icon components for use as indicators, triggers, and decorative elements.",
  anatomy: [
    { name: "Chevron", indent: 0, note: "Directional SVG icon with rotation animation and size variants" },
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
        'All icons render with aria-hidden="true" since they are decorative. Always pair with a text label for screen readers.',
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
}
