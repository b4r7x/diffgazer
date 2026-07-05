import type { ComponentDoc } from "./types";

export const sidebarDoc: ComponentDoc = {
  description:
    "Full-height navigation sidebar with tri-state visibility (open/rail/hidden), five active-marker variants, collapsible sections, optional intent tones, mobile sheet, and a configurable global hotkey. Composable parts plus two context providers.",
  anatomy: [
    {
      name: "SidebarProvider",
      indent: 0,
      note: "Optional wrapper for external state control. Owns breakpoint + shortcutKey.",
    },
    {
      name: "Sidebar",
      indent: 1,
      note: "Root nav element (standalone or within SidebarProvider). Owns variant + autoTone.",
    },
    { name: "SidebarHeader", indent: 2, note: "Top section with bottom border" },
    { name: "SidebarContent", indent: 2, note: "Scrollable middle area" },
    {
      name: "SidebarSection",
      indent: 3,
      note: "Grouping container (optional collapsible, supports controlled open/onOpenChange)",
    },
    {
      name: "SidebarSectionTitle",
      indent: 4,
      note: "Section label heading. Disclosure-pattern toggle when collapsible.",
    },
    {
      name: "SidebarSectionContent",
      indent: 4,
      note: "Panel slot for collapsible sections. Wraps items so the title's aria-controls targets a single id.",
    },
    {
      name: "SidebarItem",
      indent: 5,
      note: 'Nav row. Renders as <a> by default; pass as="button" for actions. Render-prop variant supported.',
    },
    { name: "SidebarItemLabel", indent: 6, note: "Truncated text label slot for SidebarItem" },
    { name: "SidebarItemBadge", indent: 6, note: "Trailing metadata/badge slot for SidebarItem" },
    { name: "SidebarFooter", indent: 2, note: "Bottom section with top border" },
    {
      name: "SidebarTrigger",
      indent: 1,
      note: "Toggle button. Desktop cycles open ↔ rail; mobile cycles open ↔ hidden.",
    },
  ],
  notes: [
    {
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "Sidebar's arrow-key navigation imports from the required @diffgazer/keys peer. Package consumers must install @diffgazer/keys with @diffgazer/ui; packages are not yet published to npm, so use a local checkout until the first release. Importing @diffgazer/ui/components/sidebar without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
    {
      title: "Tri-state visibility",
      content:
        'Sidebar tracks three states via SidebarProvider: "open" (full width), "rail" (collapsed glyph rail, desktop only), and "hidden" (off-canvas; mobile sheet target). The provider exposes state/defaultState/onStateChange and helpers toggleSidebar (open ↔ rail) and toggleHidden (open ↔ hidden).',
    },
    {
      title: "Mobile sheet",
      content:
        "Below the breakpoint (default 1024px) the nav renders inside a Dialog sheet anchored to the viewport's left edge. The SidebarTrigger flips behaviour automatically: desktop toggles rail; mobile toggles the hidden sheet. The breakpoint is configurable on SidebarProvider.",
    },
    {
      title: "Global hotkey",
      content:
        'An explicit SidebarProvider binds a configurable global shortcut. Cmd/Ctrl+<key> cycles open ↔ rail; Shift+Cmd/Ctrl+<key> toggles hidden. Default key is "b" (VS Code convention). Pass shortcutKey={null} to disable. A Sidebar used without a provider never binds the hotkey — global keys are an app-level contract, so opt in by mounting the provider. Editable targets (input/textarea/contenteditable/select) skip the handler.',
    },
    {
      title: "SidebarProvider vs standalone",
      content:
        "Wrap Sidebar in SidebarProvider when you need to control state from outside the sidebar, react to it elsewhere (e.g. a header trigger), or enable the global hotkey. When Sidebar is used without a provider it instantiates one internally without the hotkey. Read state from any descendant via useSidebar().",
    },
    {
      title: "Visual variants",
      content:
        "Five active-marker variants share one rule — structure is permanent, markers appear on the active row: caret (reserved chevron marker slot; invisible at rest, dim on hover, foreground on active), inverted (full-bleed bg-foreground row), bar (2px border-l plus soft fill on active), terminal (chevron prompt on active; 1px hairline left rail, no bg fill), tree (bold section headers with stroke-chevron folds; single-hairline CSS connectors — trunk/tick/corner — with soft active fill). Selected via <Sidebar variant=…> and propagated to items via context. Exposed as data-variant on the nav root.",
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
      title: "Rail mode naming",
      content:
        "In rail state the visible label and badge collapse to display:none, leaving an icon-only row. SidebarItem automatically preserves the accessible name by rendering an sr-only copy of its label content that appears in the accessibility tree only while the sidebar is in rail state, so icon-only links and buttons keep a non-empty name. Render-prop items own their own markup, so supply an aria-label (or sr-only text) for the rail state yourself.",
    },
    {
      title: "Item render props",
      content:
        "SidebarItem supports a render-prop children for custom elements (e.g. framework Link components). The render function receives ref, className, disabled, aria-current, aria-disabled, data-selected, data-intent, data-value, onClick, tabIndex, and itemPrefix — a ReactNode carrying the intent dot and variant glyph. Destructure itemPrefix and render it as the element's leading content; never spread it onto the element.",
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
    { name: "sidebar-variant-tree", title: "Variant — tree" },
    { name: "sidebar-collapsible", title: "Collapsible sections" },
    { name: "sidebar-rail", title: "Rail mode" },
    { name: "sidebar-mobile-sheet", title: "Mobile sheet" },
    { name: "sidebar-auto-tone", title: "Auto-tone intent dots" },
    { name: "sidebar-render-prop", title: "Render-prop items" },
  ],
  keyboard: {
    description:
      "Sidebar.Content owns roving arrow navigation for visible items. SidebarProvider also binds the global Cmd/Ctrl+B shortcut by default and skips editable targets.",
    keys: [
      {
        keys: "ArrowUp / ArrowDown",
        action: "Moves focus to the previous or next visible Sidebar.Item.",
      },
      { keys: "Home / End", action: "Moves focus to the first or last visible item." },
      {
        keys: "Enter / Space",
        action: "Activates a focused button item; links use their native activation behavior.",
      },
      {
        keys: "Cmd/Ctrl+B",
        action: "Cycles desktop sidebar state between open and rail.",
      },
      {
        keys: "Shift+Cmd/Ctrl+B",
        action: "Toggles the hidden/mobile-sheet state.",
      },
    ],
    examples: [
      { name: "sidebar-default", title: "Default" },
      { name: "sidebar-collapsible", title: "Collapsible sections" },
    ],
  },
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "Sidebar / Sidebar.Content / Sidebar.Trigger",
      values: '"open" | "rail" | "hidden"',
      description: "Current provider visibility state used for root, content, and trigger styling.",
    },
    {
      attribute: "data-state",
      appliesTo: "Sidebar.Section / Sidebar.SectionContent",
      values: '"open" | "closed"',
      description: "Collapsible section disclosure state.",
    },
    {
      attribute: "data-variant",
      appliesTo: "Sidebar",
      values: '"caret" | "inverted" | "bar" | "terminal" | "tree"',
      description: "Active-marker variant applied to the nav root and consumed by descendants.",
    },
    {
      attribute: "data-selected",
      appliesTo: "Sidebar.Item",
      values: "present when active",
      description: "Marks the current page/action row.",
    },
    {
      attribute: "data-intent",
      appliesTo: "Sidebar.Item",
      values: '"neutral" | "info" | "success" | "warning" | "danger" | "accent"',
      description: "Optional or auto-derived tone for the decorative intent dot.",
    },
    {
      attribute: "data-value",
      appliesTo: "Sidebar.Item",
      values: "item value",
      description: "Stable navigation and auto-tone lookup value.",
    },
    {
      attribute: "data-auto-tone",
      appliesTo: "Sidebar",
      values: "present when enabled",
      description: "Marks roots that derive item intent from values.",
    },
    {
      attribute: "data-mobile",
      appliesTo: "Sidebar mobile sheet",
      values: '"true"',
      description: "Marks the off-canvas mobile sheet instance.",
    },
  ],
  props: {
    Sidebar: {
      variant: {
        type: '"caret" | "inverted" | "bar" | "terminal" | "tree"',
        required: false,
        defaultValue: '"caret"',
        description:
          'Visual variant. "caret" reserves a chevron marker slot shown on the active row; "inverted" full-bleeds the active row with bg-foreground; "bar" draws a 2px left edge with a soft fill on active; "terminal" shows the chevron prompt on the active item and draws a 1px hairline left rail with no background fill; "tree" renders bold section headers with stroke-chevron folds and single-hairline connectors with a soft active fill. Propagated to items via context and exposed as data-variant on the nav root.',
      },
      autoTone: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "When true, renders a small intent dot before each item label and derives intent from the item value via the built-in dictionary unless overridden by an explicit intent prop on the item. Color is decoration only (WCAG 1.4.1) — pair with a text/glyph cue.",
      },
      embedded: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "When true, keeps navigation inline on mobile instead of portaling into the built-in Dialog sheet. Use when a parent shell already owns the mobile drawer or overlay.",
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
        description:
          'Controlled visibility state. "open" = full width, "rail" = collapsed glyph rail (desktop), "hidden" = off-canvas (used by the mobile sheet).',
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
        description:
          "Viewport width (px) below which the sidebar collapses into a mobile sheet. Default matches Tailwind lg.",
      },
      shortcutKey: {
        type: "string | null",
        required: false,
        defaultValue: '"b"',
        description:
          "Case-insensitive hotkey. Cmd/Ctrl+<key> cycles open ↔ rail; Shift+Cmd/Ctrl+<key> toggles hidden. Pass null to disable.",
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
        defaultValue:
          '"Expand sidebar" / "Collapse sidebar" / "Open navigation" / "Close navigation"',
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
        description:
          "Scrollable middle region. Hidden, aria-hidden, and inert when the sidebar is in the rail/hidden state.",
      },
    },
    "Sidebar.Section": {
      collapsible: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "When true, Sidebar.SectionTitle becomes a disclosure toggle that expands/collapses the section.",
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
        defaultValue: '<Chevron open={isOpen} size="sm" />',
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
        description:
          "Panel for collapsible sections. Wires the section title's aria-controls and applies hidden when the section is closed. For non-collapsible sections this is a no-op wrapper and may be omitted.",
      },
    },
    "Sidebar.Item": {
      as: {
        type: '"a" | "button"',
        required: false,
        defaultValue: '"a"',
        description:
          'Rendered element. Items are navigation links by default; pass as="button" for non-navigation actions.',
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          'Marks the item as the current page. Adds aria-current="page", data-selected, and the variant\'s active styling.',
      },
      value: {
        type: "string",
        required: false,
        defaultValue: "auto-generated id",
        description:
          "Stable identifier exposed as data-value for keyboard navigation and intent lookup.",
      },
      intent: {
        type: '"neutral" | "info" | "success" | "warning" | "danger" | "accent"',
        required: false,
        defaultValue: "undefined (or auto from value when autoTone is enabled)",
        description:
          "Item intent. Renders as data-intent and tints the auto-tone dot from semantic tokens: neutral → --muted-foreground, info → --info-strong, success → --success-strong, warning → --warning-strong, danger → --error-strong, accent → --action. When autoTone is enabled on Sidebar and intent is omitted, it is inferred from value via the built-in dictionary. Color is decoration only — pair with a text/glyph cue.",
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
        description:
          "Item content or a render function (for framework Link components) that receives ref, className, disabled, aria-current, aria-disabled, data-selected, data-intent, data-value, onClick, tabIndex, and itemPrefix. itemPrefix is a ReactNode (intent dot, variant glyph) that must be rendered as the element's leading content, never spread onto the element.",
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
};
