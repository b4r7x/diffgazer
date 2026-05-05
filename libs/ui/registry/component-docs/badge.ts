import type { ComponentDoc } from "./types"

export const badgeDoc: ComponentDoc = {
  description: "Inline status label with semantic color variants.",
  anatomy: [
    { name: "Badge", indent: 0, note: "Root label container with variant and size styling" },
  ],
  notes: [
    {
      title: "Dot Prop",
      content: "Set dot={true} to render a colored status indicator before the label content.",
    },
    {
      title: "Dynamic Content",
      content:
        "For badges with content that updates (e.g., unread counts), add role=\"status\" to the Badge for screen reader announcements. Static badges (labels like \"Beta\" or \"New\") need no additional ARIA.",
    },
  ],
  usage: { example: "badge-default" },
  examples: [
    { name: "badge-default", title: "Default" },
    { name: "badge-variants", title: "Variants" },
    { name: "badge-sizes", title: "Sizes" },
  ],
  keyboard: null,
}