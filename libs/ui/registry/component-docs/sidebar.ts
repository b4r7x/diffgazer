import type { ComponentDoc } from "./types"

export const sidebarDoc: ComponentDoc = {
  description:
    "Full-height navigation sidebar with collapsible sections, composable item badges, provider pattern for external control, and collapsed mode. 11 composable parts, 2 context providers.",
  anatomy: [
    { name: "SidebarProvider", indent: 0, note: "Optional wrapper for external sidebar control (collapsed state)" },
    { name: "Sidebar", indent: 1, note: "Root nav element (standalone or within SidebarProvider)" },
    { name: "SidebarHeader", indent: 2, note: "Top section with bottom border" },
    { name: "SidebarContent", indent: 2, note: "Scrollable middle area" },
    { name: "SidebarSection", indent: 3, note: "Grouping container (optional collapsible, supports controlled open/onOpenChange)" },
    { name: "SidebarSectionTitle", indent: 4, note: "Section label with collapse toggle" },
    { name: "SidebarItem", indent: 4, note: "Clickable nav item with active state and render-prop support" },
    { name: "SidebarItemLabel", indent: 5, note: "Truncated text label slot for SidebarItem" },
    { name: "SidebarItemBadge", indent: 5, note: "Trailing metadata/badge slot for SidebarItem" },
    { name: "SidebarFooter", indent: 2, note: "Bottom section with top border" },
    { name: "SidebarTrigger", indent: 1, note: "Toggle button for sidebar collapsed state (use within SidebarProvider)" },
  ],
  notes: [
    {
      title: "SidebarProvider",
      content:
        "Wrap both Sidebar and your main content in SidebarProvider to control collapsed state from outside the sidebar. Use the useSidebar() hook to read/toggle state from any child component. When Sidebar is used without a provider, it manages its own state.",
    },
    {
      title: "Collapsible Sections",
      content:
        "SidebarSection accepts collapsible={true} to enable expand/collapse. Supports controlled state via open/onOpenChange props. SidebarSectionTitle renders a toggle arrow. When collapsed, SidebarItems inside the section are hidden.",
    },
    {
      title: "Item Badge Part",
      content:
        "Use SidebarItemBadge inside SidebarItem for trailing labels like 'new' or counts. This keeps badge semantics explicit and styling predictable.",
    },
    {
      title: "Collapsed Mode",
      content:
        "Sidebar supports a collapsed prop (controlled or uncontrolled via defaultCollapsed) that signals the sidebar should render in a compact state. Child components can read this via useSidebar().",
    },
    {
      title: "Dual Context",
      content:
        "SidebarProvider or Sidebar provides SidebarContext (collapsed state) at the root level. SidebarSection provides SidebarSectionContext (open/closed state) for its children. SidebarItem reads the section context to hide itself when the section is collapsed.",
    },
    {
      title: "Item Render Props",
      content:
        "SidebarItem supports render-prop children for custom elements (e.g., framework Link components). The render function receives ref, className, disabled, and aria-current props.",
    },
  ],
  usage: { example: "sidebar-default" },
  examples: [
    { name: "sidebar-default", title: "Default" },
    { name: "sidebar-collapsible", title: "Collapsible" },
    { name: "sidebar-render-prop", title: "Render Prop" },
  ],
  keyboard: null,
}
