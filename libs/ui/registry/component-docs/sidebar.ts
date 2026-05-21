import type { ComponentDoc } from "./types"

export const sidebarDoc: ComponentDoc = {
  description:
    "Full-height navigation sidebar with tri-state visibility (open/rail/hidden), five active-marker variants, collapsible sections, optional intent tones, mobile sheet, and a configurable global hotkey. Composable parts plus two context providers.",
  anatomy: [
    { name: "SidebarProvider", indent: 0, note: "Optional wrapper for external state control. Owns breakpoint + shortcutKey." },
    { name: "Sidebar", indent: 1, note: "Root nav element (standalone or within SidebarProvider). Owns variant + autoTone." },
    { name: "SidebarHeader", indent: 2, note: "Top section with bottom border" },
    { name: "SidebarContent", indent: 2, note: "Scrollable middle area" },
    { name: "SidebarSection", indent: 3, note: "Grouping container (optional collapsible, supports controlled open/onOpenChange)" },
    { name: "SidebarSectionTitle", indent: 4, note: "Section label heading. Disclosure-pattern toggle when collapsible." },
    { name: "SidebarSectionContent", indent: 4, note: "Panel slot for collapsible sections. Wraps items so the title's aria-controls targets a single id." },
    { name: "SidebarItem", indent: 5, note: "Nav row. Renders as <a> by default; pass as=\"button\" for actions. Render-prop variant supported." },
    { name: "SidebarItemLabel", indent: 6, note: "Truncated text label slot for SidebarItem" },
    { name: "SidebarItemBadge", indent: 6, note: "Trailing metadata/badge slot for SidebarItem" },
    { name: "SidebarFooter", indent: 2, note: "Bottom section with top border" },
    { name: "SidebarTrigger", indent: 1, note: "Toggle button. Desktop cycles open ↔ rail; mobile cycles open ↔ hidden." },
  ],
  notes: [
    {
      title: "Tri-state visibility",
      content:
        "Sidebar tracks three states via SidebarProvider: \"open\" (full width), \"rail\" (collapsed glyph rail, desktop only), and \"hidden\" (off-canvas; mobile sheet target). The provider exposes state/defaultState/onStateChange and helpers toggleSidebar (open ↔ rail) and toggleHidden (open ↔ hidden).",
    },
    {
      title: "Mobile sheet",
      content:
        "Below the breakpoint (default 1024px) the nav renders inside a Dialog sheet anchored to the viewport's left edge. The SidebarTrigger flips behaviour automatically: desktop toggles rail; mobile toggles the hidden sheet. The breakpoint is configurable on SidebarProvider.",
    },
    {
      title: "Global hotkey",
      content:
        "SidebarProvider binds a configurable global shortcut. Cmd/Ctrl+<key> cycles open ↔ rail; Shift+Cmd/Ctrl+<key> toggles hidden. Default key is \"b\" (VS Code convention). Pass shortcutKey={null} to disable. Editable targets (input/textarea/contenteditable/select) skip the handler.",
    },
    {
      title: "SidebarProvider vs standalone",
      content:
        "Wrap Sidebar in SidebarProvider when you need to control state from outside the sidebar or react to it elsewhere (e.g. a header trigger). When Sidebar is used without a provider it instantiates one internally. Read state from any descendant via useSidebar().",
    },
    {
      title: "Visual variants",
      content:
        "Five active-marker variants share row metrics (24px line height, JBMono 12px) so glyph slots stay aligned: caret (▸ glyph prefix; active = font-semibold), inverted (full-bleed bg-foreground row), bar (1px border-l on active), bracket ([*]/[ ] glyph prefix), block (soft bg-foreground/8 fill on active). Selected via <Sidebar variant=…> and propagated to items via context. Exposed as data-variant on the nav root.",
    },
    {
      title: "Auto-tone (intent dot)",
      content:
        "Opt-in via <Sidebar autoTone>. Renders a small dot before each item label whose color is derived from the item value through a built-in dictionary (added → success, deleted → danger, modified → warning, etc.) or from an explicit intent prop on SidebarItem. Color is decoration only (WCAG 1.4.1) — always pair with a text/glyph cue (the label, a badge).",
    },
    {
      title: "Collapsible sections",
      content:
        "SidebarSection accepts collapsible. SidebarSectionTitle renders an ARIA disclosure (h3 wrapping a button with aria-expanded/aria-controls). SidebarSectionContent panels the collapsed area; it uses the section context to set hidden when closed. Supports controlled open/onOpenChange or uncontrolled defaultOpen.",
    },
    {
      title: "Item render props",
      content:
        "SidebarItem supports a render-prop children for custom elements (e.g. framework Link components). The render function receives ref, className, disabled, aria-current, aria-disabled, data-active, data-intent, data-value, onClick, tabIndex.",
    },
    {
      title: "SSR persistence",
      content:
        "The provider exports SIDEBAR_STATE_COOKIE but intentionally does not read or write it. SSR frameworks should parse the cookie in their loader, pass the resolved value as defaultState, and mirror onStateChange writes back via document.cookie (SameSite=Lax, 1y).",
    },
  ],
  usage: { example: "sidebar-default" },
  examples: [
    { name: "sidebar-default", title: "Default" },
    { name: "sidebar-variant-caret", title: "Variant — caret" },
    { name: "sidebar-variant-inverted", title: "Variant — inverted" },
    { name: "sidebar-variant-bar", title: "Variant — bar" },
    { name: "sidebar-variant-bracket", title: "Variant — bracket" },
    { name: "sidebar-variant-block", title: "Variant — block" },
    { name: "sidebar-collapsible", title: "Collapsible sections" },
    { name: "sidebar-rail", title: "Rail mode" },
    { name: "sidebar-mobile-sheet", title: "Mobile sheet" },
    { name: "sidebar-auto-tone", title: "Auto-tone intent dots" },
    { name: "sidebar-render-prop", title: "Render-prop items" },
  ],
  keyboard: null,
  props: {
    Sidebar: {
      variant: {
        type: '"caret" | "inverted" | "bar" | "bracket" | "block"',
        required: false,
        defaultValue: '"caret"',
        description:
          'Visual variant. "caret" prefixes each item with ▸; "inverted" full-bleeds the active row with bg-foreground; "bar" draws a 1px left border on active; "bracket" prefixes items with [*]/[ ]; "block" applies a soft bg-foreground/8 fill on active. Propagated to items via context and exposed as data-variant on the nav root.',
      },
      autoTone: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "When true, renders a small intent dot before each item label and derives intent from the item value via the built-in dictionary unless overridden by an explicit intent prop on the item. Color is decoration only (WCAG 1.4.1) — pair with a text/glyph cue.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Sidebar subparts (Header, Content, Footer, Trigger).",
      },
    },
    "Sidebar.Provider": {
      state: {
        type: '"open" | "rail" | "hidden"',
        required: false,
        defaultValue: null,
        description: 'Controlled visibility state. "open" = full width, "rail" = collapsed glyph rail (desktop), "hidden" = off-canvas (used by the mobile sheet).',
      },
      defaultState: {
        type: '"open" | "rail" | "hidden"',
        required: false,
        defaultValue: '"open"',
        description: "Initial visibility state for uncontrolled use.",
      },
      onStateChange: {
        type: '(state: "open" | "rail" | "hidden") => void',
        required: false,
        defaultValue: null,
        description: "Fired when the visibility state changes (controlled and uncontrolled).",
      },
      breakpoint: {
        type: "number",
        required: false,
        defaultValue: "1024",
        description: "Viewport width (px) below which the sidebar collapses into a mobile sheet. Default matches Tailwind lg.",
      },
      shortcutKey: {
        type: "string | null",
        required: false,
        defaultValue: '"b"',
        description: "Case-insensitive hotkey. Cmd/Ctrl+<key> cycles open ↔ rail; Shift+Cmd/Ctrl+<key> toggles hidden. Pass null to disable.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Sidebar and main content that need access to the state via useSidebar().",
      },
    },
    "Sidebar.Trigger": {
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: '"Expand sidebar" / "Collapse sidebar" / "Open navigation" / "Close navigation"',
        description: "Accessible name. Defaults to a state- and device-derived label.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: '"[≡]" (collapsed) / "[×]" (open)',
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
        description: "Scrollable middle region. Hidden, aria-hidden, and inert when the sidebar is in the rail/hidden state.",
      },
    },
    "Sidebar.Section": {
      collapsible: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "When true, Sidebar.SectionTitle becomes a disclosure toggle that expands/collapses the section.",
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
        description: "Section subparts (SectionTitle, SectionContent, Items).",
      },
    },
    "Sidebar.SectionTitle": {
      headingLevel: {
        type: '"h1" | "h2" | "h3" | "h4" | "h5" | "h6"',
        required: false,
        defaultValue: '"h3"',
        description:
          "Heading level rendered for the section title. Default h3 keeps screen-reader heading-rotor navigation predictable. Collapsible sections wrap a button with aria-expanded/aria-controls inside the heading.",
      },
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
    "Sidebar.SectionContent": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Panel for collapsible sections. Wires the section title's aria-controls and applies hidden when the section is closed. For non-collapsible sections this is a no-op wrapper and may be omitted.",
      },
    },
    "Sidebar.Item": {
      as: {
        type: '"a" | "button"',
        required: false,
        defaultValue: '"a"',
        description: 'Rendered element. Items are navigation links by default; pass as="button" for non-navigation actions.',
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: 'Marks the item as the current page. Adds aria-current="page", data-active="true", and the variant\'s active styling.',
      },
      value: {
        type: "string",
        required: false,
        defaultValue: "auto-generated id",
        description: "Stable identifier exposed as data-value for keyboard navigation and intent lookup.",
      },
      intent: {
        type: '"neutral" | "info" | "success" | "warning" | "danger" | "accent"',
        required: false,
        defaultValue: "undefined (or auto from value when autoTone is enabled)",
        description: "Item intent. Renders as data-intent. When autoTone is enabled on Sidebar and intent is omitted, it is inferred from value via the built-in dictionary. Color is decoration only — pair with a text/glyph cue.",
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
        description: "Item content or a render function (for framework Link components) that receives ref, className, disabled, aria-current, aria-disabled, data-active, data-intent, data-value, onClick, tabIndex.",
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
