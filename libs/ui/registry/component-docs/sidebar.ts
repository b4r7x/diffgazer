import type { ComponentDoc } from "./types"

export const sidebarDoc: ComponentDoc = {
  description:
    "Full-height navigation sidebar with collapsible sections, composable item badges, provider pattern for external control, and open/closed mode. 11 composable parts, 2 context providers.",
  anatomy: [
    { name: "SidebarProvider", indent: 0, note: "Optional wrapper for external sidebar control (open/closed state)" },
    { name: "Sidebar", indent: 1, note: "Root nav element (standalone or within SidebarProvider)" },
    { name: "SidebarHeader", indent: 2, note: "Top section with bottom border" },
    { name: "SidebarContent", indent: 2, note: "Scrollable middle area" },
    { name: "SidebarSection", indent: 3, note: "Grouping container (optional collapsible, supports controlled open/onOpenChange)" },
    { name: "SidebarSectionTitle", indent: 4, note: "Section label with collapse toggle" },
    { name: "SidebarItem", indent: 4, note: "Clickable nav item with active state and render-prop support" },
    { name: "SidebarItemLabel", indent: 5, note: "Truncated text label slot for SidebarItem" },
    { name: "SidebarItemBadge", indent: 5, note: "Trailing metadata/badge slot for SidebarItem" },
    { name: "SidebarFooter", indent: 2, note: "Bottom section with top border" },
    { name: "SidebarTrigger", indent: 1, note: "Toggle button for sidebar open state (use within SidebarProvider)" },
  ],
  notes: [
    {
      title: "SidebarProvider",
      content:
        "Wrap both Sidebar and your main content in SidebarProvider to control open state from outside the sidebar. Use the useSidebar() hook to read/toggle state from any child component. When Sidebar is used without a provider, it manages its own state.",
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
      title: "Open/Closed Mode",
      content:
        "Sidebar supports an open prop (controlled or uncontrolled via defaultOpen) that signals the sidebar visibility. Child components can read this via useSidebar().",
    },
    {
      title: "Dual Context",
      content:
        "SidebarProvider or Sidebar provides SidebarContext (open state) at the root level. SidebarSection provides SidebarSectionContext (open/closed state) for its children. SidebarItem reads the section context to hide itself when the section is closed.",
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
  props: {
    Sidebar: {
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled open state. Ignored when wrapped in SidebarProvider.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Initial open state for uncontrolled standalone use.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the open state changes (standalone mode).",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Sidebar subparts (Header, Content, Footer, Trigger).",
      },
    },
    "Sidebar.Provider": {
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled open state shared with descendants.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Initial open state.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the open state changes.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Sidebar and main content that need access to the open state via useSidebar().",
      },
    },
    "Sidebar.Trigger": {
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: '"Expand sidebar" / "Collapse sidebar"',
        description: "Accessible name. Defaults to a state-derived label.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Trigger button content (typically an icon).",
      },
    },
    "Sidebar.Header": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Top region content.",
      },
    },
    "Sidebar.Content": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Scrollable middle region. Hidden, aria-hidden, and inert when the sidebar is collapsed.",
      },
    },
    "Sidebar.Section": {
      collapsible: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "When true, Sidebar.SectionTitle becomes a toggle that expands/collapses the section.",
      },
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled open state for the section.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Initial open state for the section.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the section open state changes.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Section subparts (SectionTitle, Items).",
      },
    },
    "Sidebar.SectionTitle": {
      handle: {
        type: "ReactNode | null",
        required: false,
        defaultValue: "<Chevron open={isOpen} size=\"sm\" />",
        description: "Custom handle element for collapsible sections. Pass null to hide.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Section label.",
      },
    },
    "Sidebar.Item": {
      as: {
        type: '"button" | "a"',
        required: false,
        defaultValue: '"button"',
        description: 'Rendered element. Use "a" with href for navigation links.',
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: 'Marks the item as the current page. Adds aria-current="page" and active styling.',
      },
      value: {
        type: "string",
        required: false,
        defaultValue: "auto-generated id",
        description: "Stable identifier exposed as data-value for keyboard navigation.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the item. Adds aria-disabled and removes from tab order.",
      },
      children: {
        type: "ReactNode | (props: SidebarItemRenderProps) => ReactNode",
        required: true,
        defaultValue: null,
        description: "Item content or a render function (for framework Link components) that receives ref, className, disabled, aria-current, and onClick.",
      },
    },
    "Sidebar.ItemLabel": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Truncated label text.",
      },
    },
    "Sidebar.ItemBadge": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Trailing badge or metadata (e.g. count, status).",
      },
    },
    "Sidebar.Footer": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Bottom region content.",
      },
    },
  },
}
