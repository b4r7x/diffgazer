import type { ComponentDoc } from "./types"

export const panelDoc: ComponentDoc = {
  description:
    "Card-like container with composable header, title, description, content, row, and footer primitives.",
  anatomy: [
    {
      name: "Panel",
      indent: 0,
      note: "Root container. Polymorphic via `as` (div, article, section, aside). Switches to <section> automatically when Panel.Title or aria-label is present.",
    },
    {
      name: "PanelHeader",
      indent: 1,
      note: "Compound header. Title and Description live in a left column; any other child (eyebrow span, badge, button) lands in a right slot.",
    },
    {
      name: "PanelTitle",
      indent: 2,
      note: "Real heading (h2 by default, configurable via `as`). Auto-wires aria-labelledby on the Panel root.",
    },
    {
      name: "PanelDescription",
      indent: 2,
      note: "Paragraph description. Auto-wires aria-describedby on the Panel root.",
    },
    { name: "PanelContent", indent: 1, note: "Padded content area with configurable inner spacing." },
    {
      name: "PanelRow",
      indent: 2,
      note: "Key-value row primitive. Adjacent rows get an automatic top divider.",
    },
    { name: "PanelFooter", indent: 1, note: "Bottom metadata/action row." },
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
        "`density=\"default\"` uses 14/20 padding rhythm; `density=\"compact\"` uses 10/14. Header, Content, and Footer read padding from the root's data-density attribute via shared/panel.css.",
    },
    {
      title: "Header marker",
      content:
        "`PanelHeader marker=\"bar\"` (default) renders a 4px foreground bar to the left of Title/Description, matching Dialog's marker=\"bar\". Set `marker=\"none\"` for rail/custom layouts where the bar would clash.",
    },
    {
      title: "Accessibility",
      content:
        "When Panel.Title is present (or aria-label/aria-labelledby is supplied), the root renders as <section> with aria-labelledby auto-wired. With neither, the root stays a plain <div> (no nameless landmark). Panel.Description is auto-wired via aria-describedby when present.",
    },
    {
      title: "Eyebrow tags",
      content:
        "There is no Title `meta` prop on Panel (unlike Dialog) because the header has a right-slot for actions. Compose eyebrow tags (e.g. \"MAIN\", \"PROD\") as plain siblings inside PanelHeader; they land in the right slot, vertically centered next to action buttons.",
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
        defaultValue: '"div" (or "section" when Title/aria-label present)',
        description: "Rendered HTML element. Defaults to <section> when a Panel.Title or aria-label is supplied, otherwise <div>.",
      },
      frame: {
        type: '"hairline" | "rail" | "viewfinder" | "surface"',
        required: false,
        defaultValue: '"hairline"',
        description: "Visual chrome. Hairline = soft border + marker bar; rail = inline-start rail only; viewfinder = corner brackets; surface = elevated --surface-1 background.",
      },
      tone: {
        type: '"info" | "success" | "warning" | "error" | "accent"',
        required: false,
        defaultValue: "undefined",
        description: "Border-color tint. Visual cue only — no semantic role, no live announcement. Use Callout for real status messaging.",
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
        description: "Toggle the 4px foreground marker bar. Use \"none\" for rail or custom layouts.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Title and Description go in a left column; any other child lands in a right slot.",
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
        description: "Vertical gap applied between direct children inside the content area. Use spacing=\"none\" when composing Panel.Row (rows own their own padding).",
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
  },
}
