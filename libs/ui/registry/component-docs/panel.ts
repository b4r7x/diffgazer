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
      note: "Floating corner label (e.g. [ 01 / FS_TREE ]). The Panel root is the positioning context (panel.css sets position: relative on every frame), and the label sits at one constant inline-start inset that clears a corner bracket in every state.",
    },
  ],
  notes: [
    {
      title: "Frames",
      content:
        "Pick one frame via the `frame` prop: hairline (default soft border + marker bar), rail (inline-start rail drawn in --border-strong so it reads as a deliberate frame rather than a stray divider), viewfinder (four corner brackets), surface (--surface-1 background with a hairline perimeter and a 1px inner top lip in --surface-1-highlight — the fill steps lighter in dark and darker in light, and the lip is what keeps both directions reading as raised). Frame is purely visual chrome and applies independently of tone and density.",
    },
    {
      title: "Component tokens",
      content:
        "The perimeter paints `--panel-border-color`, whose default chain is `--panel-border` → `--panel-hairline` → a 60% `--border` mix. Set `--panel-border` on the panel or any ancestor (defaults resolve through var() fallbacks, so ancestor scoping reaches them) to lift the enclosure to a full-strength border while header, footer, and row hairlines stay on `--panel-hairline` — that split is what keeps the nesting ladder (panel enclosure → inner card → row hairline) readable. `--panel-border-color` itself is internal: `focused` repoints it at `--border-strong` on the hairline and surface frames (rail draws its own `--border-strong` edge, viewfinder has no border), and descendants inherit it, which is how a Panel.Label chip edge tracks the perimeter in every state without restating the chain. The other consumer tokens are `--panel-bg` (default `--background`), `--panel-fg` (default `--foreground`), `--panel-hairline`, and `--panel-tone` (the header marker bar, which `tone` overrides). Bracket geometry rides `--viewfinder-size` (12px), `--viewfinder-weight` (1px), `--viewfinder-color`, and `--viewfinder-offset` (-1px, seating the arm on the border line).",
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
        '`PanelHeader marker="bar"` (default) renders a 4px foreground bar to the left of Title/Description. Set `marker="none"` for rail/custom layouts where the bar would clash.',
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
        "Use Panel.Label variant='border' for a tab chip seated on the panel border, variant='gap' for a border cutout label, or variant='readout' to seat the label on the panel's top rule between the two bracket arms (no box — the arms are the frame). The border chip recipe is fixed: 11px bold uppercase at 0.1em tracking in --muted-foreground, a --surface-2 fill, and a 1px border reading the panel's own --panel-border-color, so the chip edge matches the enclosure while resting and while focused. The inline-start inset is constant at 1rem: a bracket arm is the same 12px whether the panel is resting or focused, so one inset clears it in every state and the label never moves when focus arrives. The readout still sits just past the arm and repaints in --ring while the pane is focused, so label and corners read as one instrument. Every label publishes data-variant and data-state='focused'; consumers do not hand-roll those offsets.",
    },
    {
      title: "Focused pane",
      content:
        '`focused` marks the panel as the active pane in a multi-pane layout: corner brackets appear on any frame drawn in --ring, at the same 12px/1px geometry the viewfinder frame rests at (seated on the border line), and a hairline or surface perimeter firms to --border-strong with them. It emits data-state="focused" and shifts no size — no padding, bracket-length, or shadow change — so toggling it never reflows the layout. It is a visual affordance only: it does not move DOM focus and does not change roles, names, or ARIA. Drive it from whatever pane-focus state the app already owns, and keep a real focus-visible outline on the interactive elements inside.',
    },
    {
      title: "Reticle grammar",
      content:
        'The corner brackets are a signature, not decoration, and they mean one thing: this is the pane the keyboard drives. Four rules, stated as prohibitions because those are the ones that get broken. (1) A panel that cannot receive keyboard focus must not use frame="viewfinder" and must not pass `focused`. (2) A screen renders at most one panel with data-state="focused" at any time — in full-screen tests, assert that the selector [data-slot="panel"][data-state="focused"] matches exactly one element. (3) frame="viewfinder" without `focused` is reserved for surfaces where the reticle is the subject rather than the chrome, such as a marketing hero lens; on product screens the reticle always means focus. (4) Geometry never encodes state: resting and focused brackets are both 12px arms at 1px stroke centered on the border line, and focus changes color only (--foreground → --ring, while a hairline or surface perimeter firms to --border-strong). A bracket thickened or lengthened to mean "focused" is out of grammar.',
    },
  ],
  usage: { example: "panel-default" },
  examples: [
    { name: "panel-default", title: "Default" },
    { name: "panel-composed", title: "Composed" },
    { name: "panel-frames", title: "Frames" },
    { name: "panel-tones", title: "Tones" },
    { name: "panel-focused", title: "Focused" },
    { name: "panel-readout", title: "Corner labels" },
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
      focused: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Marks the panel as the active pane: corner brackets render in --ring on every frame, at the geometry the viewfinder frame already rests at, and a framed perimeter firms to --border-strong — only the brackets carry --ring. Visual affordance only — it does not move focus or change ARIA.",
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
        type: '"border" | "gap" | "readout"',
        required: false,
        defaultValue: '"border"',
        description:
          'Label treatment. "border" boxes the text, "gap" cuts it into the frame, "readout" seats it on the top rule between the bracket arms and repaints in --ring while the pane is focused.',
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
