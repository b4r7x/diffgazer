import type { ComponentDoc } from "./types";

export const badgeDoc: ComponentDoc = {
  description: "Inline status label with semantic color variants.",
  anatomy: [
    { name: "Badge", indent: 0, note: "Root label container with variant and size styling" },
  ],
  notes: [
    {
      title: "Uppercase Label",
      content:
        "Badge renders its label uppercase with wide tracking — the terminal label voice used across the library. Pass mixed-case copy; the transform is presentational, so assistive tech still reads the original text.",
    },
    {
      title: "Dot Prop",
      content: "Set dot={true} to render a colored status indicator before the label content.",
    },
    {
      title: "Outline Appearance",
      content:
        'appearance="outline" drops the tinted fill and keeps the variant border and text color — for badges sitting on an already-tinted row or card.',
    },
    {
      title: "Variant Colors Across Themes",
      content:
        "Variants read theme tone tokens, so every tone carries the same hue family in both themes — success green, info blue, warning amber, error red — at the lightness each background needs. Override the --base-* primitives to retone them; the variant vocabulary stays the same.",
    },
    {
      title: "Dynamic Content",
      content:
        'For badges with content that updates (e.g., unread counts), add role="status" to the Badge for screen reader announcements. Static badges (labels like "Beta" or "New") need no additional ARIA.',
    },
  ],
  usage: { example: "badge-default" },
  examples: [
    { name: "badge-default", title: "Default" },
    { name: "badge-variants", title: "Variants" },
    { name: "badge-sizes", title: "Sizes" },
    { name: "badge-outline", title: "Outline" },
  ],
  keyboard: null,
  props: {
    Badge: {
      variant: {
        type: '"success" | "warning" | "error" | "info" | "neutral"',
        required: false,
        defaultValue: '"neutral"',
        description:
          "Semantic color token. Picks foreground, background, border, and dot color together.",
      },
      size: {
        type: '"xs" | "sm" | "md" | "lg"',
        required: false,
        defaultValue: '"sm"',
        description: "Padding and font-size token.",
      },
      appearance: {
        type: '"solid" | "outline"',
        required: false,
        defaultValue: '"solid"',
        description:
          "Solid keeps the tinted fill; outline renders border and text only on a transparent background.",
      },
      dot: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Renders a leading status dot in the variant color.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Badge label.",
      },
    },
  },
};
