import type { ComponentDoc } from "./types"

export const navigationListDoc: ComponentDoc = {
  description: "Terminal-styled navigation sidebar list with selection, keyboard navigation, and composable item parts.",
  anatomy: [
    { name: "NavigationList", indent: 0, note: "Root (manages selection state)" },
    { name: "NavigationList.Item", indent: 1, note: "Selectable list item container" },
    { name: "NavigationList.Title", indent: 2, note: "Primary item label" },
    { name: "NavigationList.Status", indent: 2, note: "Top-right status marker" },
    { name: "NavigationList.Meta", indent: 2, note: "Row 2 container for badges and subtitles" },
    { name: "NavigationList.Badge", indent: 2, note: "Standardized badge slot (uses Badge primitive)" },
    { name: "NavigationList.Subtitle", indent: 2, note: "Secondary metadata text" },
  ],
  notes: [
    {
      title: "Density",
      content: "density prop controls spacing — compact, default, or comfortable.",
    },
    {
      title: "Rich Items",
      content: "NavigationList.Item supports compound parts: NavigationList.Title, NavigationList.Meta, NavigationList.Badge, NavigationList.Subtitle, and NavigationList.Status.",
    },
    {
      title: "Headless Keyboard API",
      content: "NavigationList exposes highlighted, onHighlightChange, and onKeyDown so keyboard behavior can be composed in the app layer (including @diffgazer/keys adapters).",
    },
  ],
  usage: { example: "navigation-list-default" },
  examples: [
    { name: "navigation-list-default", title: "Default" },
    { name: "navigation-list-density", title: "Density Variants" },
    { name: "navigation-list-interactive", title: "Controlled Selection" },
  ],
  keyboard: {
    description: "Arrow keys navigate between items with wrapping. Enter activates the highlighted item. Home and End jump to the first and last items.",
    examples: [
      { name: "navigation-list-interactive", title: "External @diffgazer/keys navigation" },
    ],
  },
}
