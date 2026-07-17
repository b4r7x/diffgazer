import type { ComponentDoc } from "./types";

export const panelDoc: ComponentDoc = {
  description:
    "Card-like container with composable header, title, description, content, row, and footer primitives.",
  anatomy: [
    {
      name: "Panel",
      indent: 0,
      note: "Root container. Polymorphic via `as` (div, article, section, aside). A statically discoverable Panel.Title or explicit ARIA name switches the initial render to <section>.",
    },
    {
      name: "PanelHeader",
      indent: 1,
      note: "Compound header. Title and Description live in a left column; any other child (eyebrow span, badge, button) lands in a right slot.",
    },
    {
      name: "PanelTitle",
      indent: 2,
      note: "Real heading (h2 by default, configurable via `as`). Direct child trees auto-wire aria-labelledby; opaque wrappers need an explicit stable id and root aria-labelledby for SSR.",
    },
    {
      name: "PanelDescription",
      indent: 2,
      note: "Paragraph description. Direct child trees auto-wire aria-describedby; opaque wrappers need an explicit stable id and root aria-describedby for SSR.",
    },
    {
      name: "PanelContent",
      indent: 1,
      note: "Padded content area with configurable inner spacing.",
    },
    {
      name: "PanelRow",
      indent: 2,
      note: "Key-value row primitive. Adjacent rows get an automatic top divider.",
    },
    { name: "PanelFooter", indent: 1, note: "Bottom metadata/action row." },
    {
      name: "PanelLabel",
      indent: 1,
      note: "Floating corner label (e.g. [ 01 / FS_TREE ]). The Panel root is the positioning context (panel.css sets position: relative on every frame).",
    },
  ],
  notes: [
    {
      title: "Frames",
      content:
        "Pick one frame via the `frame` prop: hairline (default soft border + marker bar), rail (left rail only), viewfinder (four corner brackets), surface (Linear-style elevated --surface-1 background). Frame is purely visual chrome and applies independently of tone and density.",
    },
    {
      title: "Tone",
      content:
        "`tone` is a pure visual border-color tint (info, success, warning, error, accent). No icon slot, no announce, no role machinery. For status messaging with icons, live regions, dismissable, or role=alert, use Callout instead.",
    },
    {
      title: "Density",
      content:
        '`density="default"` uses 14/20 padding rhythm; `density="compact"` uses 10/14. Header, Content, and Footer read padding from the root\'s data-density attribute via panel/panel.css.',
    },
    {
      title: "Header marker",
      content:
        '`PanelHeader marker="bar"` (default) renders a 4px foreground bar to the left of Title/Description, matching Dialog\'s marker="bar". Set `marker="none"` for rail/custom layouts where the bar would clash.',
    },
    {
      title: "Accessibility",
      content:
        "A statically discoverable Panel.Title makes the initial root a <section> and auto-wires aria-labelledby; Panel.Description similarly auto-wires aria-describedby. React cannot inspect content created inside an opaque child component during SSR. For that shape, assign stable ids to the generated title and description and pass those ids to root aria-labelledby/aria-describedby. An explicit ARIA name still makes the default root a <section>. With no discoverable title or explicit name, the root stays a plain <div> (no nameless landmark).",
    },
    {
      title: "Eyebrow tags",
      content:
        'There is no Title `meta` prop on Panel (unlike Dialog) because the header has a right-slot for actions. Compose eyebrow tags (e.g. "MAIN", "PROD") as plain siblings inside PanelHeader; they land in the right slot, vertically centered next to action buttons.',
    },
    {
      title: "Corner labels",
      content:
        "Use Panel.Label variant='border' for a boxed border label, or variant='gap' for a border cutout label.",
    },
  ],
  usage: { example: "panel-default" },
  examples: [
    { name: "panel-default", title: "Default" },
    { name: "panel-composed", title: "Composed" },
    { name: "panel-frames", title: "Frames" },
    { name: "panel-tones", title: "Tones" },
  ],
  keyboard: null,
  props: {
    Panel: {
      as: {
        type: '"div" | "article" | "section" | "aside"',
        required: false,
        defaultValue:
          '"div" (or "section" when a statically discoverable Title or explicit ARIA name is present)',
        description:
          "Rendered HTML element. Defaults to <section> when a Panel.Title is statically discoverable or an explicit ARIA name is supplied, otherwise <div>.",
      },
      frame: {
        type: '"hairline" | "rail" | "viewfinder" | "surface"',
        required: false,
        defaultValue: '"hairline"',
        description:
          "Visual chrome. Hairline = soft border + marker bar; rail = inline-start rail only; viewfinder = corner brackets; surface = elevated --surface-1 background.",
      },
      tone: {
        type: '"info" | "success" | "warning" | "error" | "accent"',
        required: false,
        defaultValue: "undefined",
        description:
          "Border-color tint. Visual cue only — no semantic role, no live announcement. Use Callout for real status messaging.",
      },
      density: {
        type: '"default" | "compact"',
        required: false,
        defaultValue: '"default"',
        description: "Padding rhythm. Default = 14/20; compact = 10/14.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Panel subparts.",
      },
    },
    PanelHeader: {
      marker: {
        type: '"bar" | "none"',
        required: false,
        defaultValue: '"bar"',
        description: 'Toggle the 4px foreground marker bar. Use "none" for rail or custom layouts.',
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Title and Description go in a left column; any other child lands in a right slot.",
      },
    },
    PanelTitle: {
      as: {
        type: '"h2" | "h3" | "h4" | "h5" | "h6"',
        required: false,
        defaultValue: '"h2"',
        description: "Heading level. Defaults to h2, matching Dialog.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Title text.",
      },
    },
    PanelDescription: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Short description paragraph below the title.",
      },
    },
    PanelContent: {
      spacing: {
        type: '"none" | "sm" | "md"',
        required: false,
        defaultValue: '"md"',
        description:
          'Vertical gap applied between direct children inside the content area. Use spacing="none" when composing Panel.Row (rows own their own padding).',
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Body content.",
      },
    },
    PanelRow: {
      label: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Row label (renders left-aligned, muted).",
      },
      value: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Row value (renders right-aligned, foreground).",
      },
    },
    PanelFooter: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Footer metadata or actions.",
      },
    },
    PanelLabel: {
      variant: {
        type: '"border" | "gap"',
        required: false,
        defaultValue: '"border"',
        description: "Border style around the floating label text.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Label text (e.g. [ 01 / FS_TREE ]).",
      },
    },
  },
};
