import type { ComponentDoc } from "./types"

export const breadcrumbsDoc: ComponentDoc = {
  description:
    "Compound breadcrumb navigation with auto-separator and composable parts for links, collapsed items, and custom separators.",
  anatomy: [
    { name: "Breadcrumbs", indent: 0, note: "Root container (nav + ol). Accepts separator prop." },
    { name: "Breadcrumbs.Item", indent: 1, note: "List item — auto-inserts separator. Use current prop to mark the current page." },
    { name: "Breadcrumbs.Link", indent: 2, note: "Navigation link. Supports render-prop for custom components." },
    { name: "Breadcrumbs.Ellipsis", indent: 2, note: "Collapsed items placeholder" },
  ],
  notes: [
    {
      title: "Current Page",
      content:
        "Use the current prop on any Breadcrumbs.Item to mark it as the current page (sets aria-current='page' and bold styling).",
    },
    {
      title: "Auto-Separator",
      content:
        "Separators are inserted automatically between items. Pass separator={<ChevronRight />} to customize, or separator={null} to disable.",
    },
    {
      title: "Router Integration",
      content:
        "Use the render-prop on Breadcrumbs.Link to integrate framework link components (Next.js Link, React Router NavLink). Pass a function as children to receive computed props (ref, className, etc.) and render your custom element.",
    },
  ],
  usage: { example: "breadcrumbs-default" },
  examples: [
    { name: "breadcrumbs-default", title: "Default" },
    { name: "breadcrumbs-custom-separator", title: "Custom Separator" },
    { name: "breadcrumbs-custom-link", title: "Custom Link" },
    { name: "breadcrumbs-ellipsis", title: "Ellipsis" },
  ],
  keyboard: null,
}
