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
        "ascii renders inline bracket glyphs with text connectors, numbered renders a numbered indicator on a continuous line, and breadcrumb renders slash-separated labels.",
    },
    {
      title: "Accessibility",
      content:
        'The root is an ordered list named by aria-label (default "Progress"). The active item exposes aria-current="step", and each item includes screen-reader status text: Completed, Current, or Upcoming.',
    },
  ],
  usage: { example: "horizontal-stepper-default" },
  examples: [
    { name: "horizontal-stepper-default", title: "Default" },
    { name: "horizontal-stepper-variants", title: "Variants" },
    { name: "horizontal-stepper-variant-ascii", title: "Variant: ASCII" },
    { name: "horizontal-stepper-variant-numbered", title: "Variant: Numbered" },
    { name: "horizontal-stepper-variant-breadcrumb", title: "Variant: Breadcrumb" },
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
      description: "Derived step status.",
    },
    {
      attribute: "data-conn-completed",
      appliesTo: "HorizontalStepper.Step",
      values: '"true"',
      description: "Marks completed incoming connector segments for numbered variant styling.",
    },
    {
      attribute: "data-completed",
      appliesTo: "ASCII connector",
      values: '"true"',
      description: "Marks completed ASCII connector spans.",
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
