import type { ComponentDoc } from "./types";

export const horizontalStepperDoc: ComponentDoc = {
  description:
    "Compact horizontal progress stepper for CI bars, wizard headers, and breadcrumb-style progress. It is display-only: the active value derives completed, active, and pending step states.",
  anatomy: [
    {
      name: "HorizontalStepper",
      indent: 0,
      note: "Root ordered list. Owns steps, active value, variant, and accessible name.",
    },
    {
      name: "HorizontalStepper.Step",
      indent: 1,
      note: "List item that derives status from the parent steps/value pair.",
    },
  ],
  notes: [
    {
      title: "Status Derivation",
      content:
        "The parent steps array defines order. Steps before value are completed, the matching step is active, and following steps are pending.",
    },
    {
      title: "Variants",
      content:
        "ascii renders inline bracket glyphs with text connectors, numbered renders a numbered indicator on a continuous line, and breadcrumb renders slash-separated labels. Completed indicators and connectors read the primary token, so progress stays monochrome in both themes; the status palette is reserved for meaning.",
    },
    {
      title: "Root Element",
      content:
        "The root accepts the full ordered-list contract: id, data-*, ref, and any other <ol> attribute is spread onto the element, matching the vertical Stepper.",
    },
    {
      title: "Constrained Containers",
      content:
        'Steps and connectors never break internally, so a narrow parent cannot wrap a label mid-word or split the [ ] glyph across two lines. The root declares a container query instead, in two tiers. Below 36rem of inline space the stepper collapses to the compact treatment: connectors drop out, non-active labels leave the layout, and the active label is prefixed with "Step 3/6 ·". Below 20rem even that glyph run stops fitting, so it drops out as well and the stepper reads as plain "Step 3/6 · Label" text. Because both switches are container queries and not viewport breakpoints, the same stepper adapts inside a sidebar, a dialog, and a full-width page without the consumer branching. Pass compact to force the first tier at any width; the second still follows the container.',
    },
    {
      title: "Accessibility",
      content:
        'The root is an ordered list named by aria-label (default "Progress"). The active item exposes aria-current="step", and each item includes screen-reader status text: Completed, Current, or Upcoming. Both compact tiers only collapse things visually — every step and its label stay in the accessibility tree, and the "Step 3/6 ·" prefix is aria-hidden because list position already conveys it.',
    },
  ],
  usage: { example: "horizontal-stepper-default" },
  examples: [
    { name: "horizontal-stepper-default", title: "Default" },
    { name: "horizontal-stepper-variants", title: "Variants" },
    { name: "horizontal-stepper-variant-ascii", title: "Variant: ASCII (start, mid-run, done)" },
    { name: "horizontal-stepper-variant-numbered", title: "Variant: Numbered" },
    { name: "horizontal-stepper-variant-breadcrumb", title: "Variant: Breadcrumb" },
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
      steps: {
        type: "string[]",
        required: true,
        defaultValue: null,
        description:
          "Ordered step ids used to compute completed/active/pending status relative to value.",
      },
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
          'Forces the compact treatment (connectors hidden, only the active step labelled, prefixed with "Step 3/6 ·"). When false the stepper adopts it automatically below a 36rem container. Below a 20rem container the glyph run drops out too, leaving only the text, with or without this prop.',
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
        description: "HorizontalStepper.Step children, one per id in steps.",
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
        description: "Step id matched against the parent value to derive status.",
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
