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
      title: "Composition Contract",
      content: "Use NavigationList.Item and its static parts as explicit children in the NavigationList JSX tree. Custom item UI belongs inside NavigationList.Item. Components that create items internally from an opaque wrapper are not part of the current public contract.",
    },
    {
      title: "Density",
      content: "density prop controls spacing — compact, default, or comfortable.",
    },
    {
      title: "Rich Items",
      content: "NavigationList.Item supports compound parts: NavigationList.Title, NavigationList.Meta, NavigationList.Badge, NavigationList.Subtitle, and NavigationList.Status.",
    },
    {
      title: "Built-in Keyboard API",
      content: "NavigationList includes arrow-key navigation and exposes highlightedId, onHighlightChange, onEnter, onNavigationBoundaryReached, autoFocus, focused, and onKeyDown for controlled highlight state or extra app-level shortcuts.",
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
