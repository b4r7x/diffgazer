import type { ComponentDoc } from "./types.js";

export const horizontalStepperDoc: ComponentDoc = {
  description:
    "Compact horizontal progress stepper for CI bars, wizard headers, and breadcrumb-style progress. It is display-only: the active value derives completed, active, and pending step states.",
  anatomy: [
    {
      name: "HorizontalStepper",
      indent: 0,
      note: "Root ordered list. Owns the active value, variant, and accessible name.",
    },
    {
      name: "HorizontalStepper.Step",
      indent: 1,
      note: "List item whose value and render order derive status from the parent value.",
    },
  ],
  notes: [
    {
      title: "Status Derivation",
      content:
        "Rendered HorizontalStepper.Step children define order. Steps before value are completed, the matching step is active, and following steps are pending.",
    },
    {
      title: "Variants",
      content:
        "ascii renders inline bracket glyphs with text connectors, numbered renders a numbered indicator on a continuous line, and breadcrumb renders slash-separated labels. Completed indicators and connectors read the primary token, so progress stays monochrome in both themes; the status palette is reserved for meaning.",
    },
    {
      title: "Glyph Hierarchy",
      content:
        "ascii glyphs share the form family's grammar: the brackets render muted as chrome and the inner mark ([x], [~]) keeps the step's status tone at bold weight, so completed and active marks carry the contrast and a pending [ ] reads entirely as chrome. The visible text is unchanged.",
    },
    {
      title: "Root Element",
      content:
        "The root accepts the full ordered-list contract: id, data-*, ref, and any other <ol> attribute is spread onto the element, matching the vertical Stepper.",
    },
    {
      title: "Constrained Containers",
      content:
        'Steps and connectors never break internally, so a narrow parent cannot wrap a label mid-word or split the [ ] glyph across two lines. The root declares a container query instead, in three tiers. Below 36rem of inline space the stepper collapses to the compact treatment: connectors drop out, non-active labels leave the layout, and the active label is prefixed with "Step 3/6 ·". Narrower still, the glyph run becomes a viewfinder window — previous, active, next, plus muted "+2" / "+1" counters for the steps it elides — which makes the run a constant width for any step count. That window engages from need, not from a blanket width: the threshold is keyed by variant and step count, so a four-step ascii run keeps its full run down to 18rem while a twelve-step run windows from 32rem. Below 14rem only the active step remains, but its glyph never drops: the stepper always shows progress. Because every switch is a container query and not a viewport breakpoint, the same stepper adapts inside a sidebar, a dialog, and a full-width page without the consumer branching. Pass compact to force the first two tiers at any width; the narrowest still follows the container.',
    },
    {
      title: "Accessibility",
      content:
        'The root is an ordered list named by aria-label (default "Progress"). The active item exposes aria-current="step", and each item includes screen-reader status text: Completed, Current, or Upcoming. Every compact tier only collapses things visually — every step and its label stay in the accessibility tree at every width. The "Step 3/6 ·" prefix and the "+2" / "+1" elision counters are aria-hidden, because list position and the step statuses already carry that information.',
    },
  ],
  usage: { example: "horizontal-stepper-default" },
  examples: [
    { name: "horizontal-stepper-default", title: "Default" },
    { name: "horizontal-stepper-variants", title: "Variants" },
    { name: "horizontal-stepper-variant-ascii", title: "Variant: ASCII (start, mid-run, done)" },
    { name: "horizontal-stepper-compact", title: "Compact / Constrained Width" },
    { name: "horizontal-stepper-progress", title: "Progress" },
  ],
  keyboard: {
    description:
      "HorizontalStepper is display-only. It renders list semantics and aria-current for the active step, but it does not own keyboard handlers.",
    keys: [],
    examples: [],
  },
  dataAttributes: [
    {
      attribute: "data-variant",
      appliesTo: "HorizontalStepper",
      values: '"ascii" | "numbered" | "breadcrumb"',
      description: "Visual variant on the root ordered list.",
    },
    {
      attribute: "data-status",
      appliesTo: "HorizontalStepper.Step",
      values: '"completed" | "active" | "pending"',
      description:
        "Derived step status. It is also the only hook connector styling needs: the numbered variant fills the incoming segment on data-status=completed.",
    },
    {
      attribute: "data-counter",
      appliesTo: "HorizontalStepper.Step",
      values: "present in numbered variant",
      description: "CSS-counter hook for pending and active numbered indicators.",
    },
  ],
  props: {
    HorizontalStepper: {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Id of the active step.",
      },
      variant: {
        type: '"ascii" | "numbered" | "breadcrumb"',
        required: false,
        defaultValue: '"ascii"',
        description: "Visual variant. Drives glyphs, connectors, and label typography.",
      },
      compact: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          'Forces the compact treatment (connectors hidden, only the active step labelled and prefixed with "Step 3/6 ·", glyph run windowed to previous/active/next with elision counters). When false the stepper adopts each tier automatically: the compact treatment below a 36rem container, and the window at a threshold derived from the variant and the step count. Below a 14rem container only the active step remains, with or without this prop.',
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: '"Progress"',
        description: "Accessible name for the root ordered list.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description:
          "HorizontalStepper.Step children in render order. Their value props define the step ids.",
      },
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Additional class names merged onto the root ordered list.",
      },
    },
    "HorizontalStepper.Step": {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Step id matched against the parent value to derive status and order.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Step label.",
      },
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Additional class names merged onto the step item.",
      },
    },
  },
};
