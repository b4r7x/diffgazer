import type { ComponentDoc } from "./types";

export const stepperDoc: ComponentDoc = {
  description:
    "Step-by-step progress indicator with expandable steps, substeps, and five visual variants. Compound component with context-based state management, roving tabIndex keyboard model, and a polite live region for active-step announcements. A separate `HorizontalStepper` primitive ships alongside for compact CI-bar / wizard-header use cases (three matching horizontal variants).",
  anatomy: [
    { name: "Stepper", indent: 0, note: "Root provider (manages expansion + variant)" },
    { name: "StepperStep", indent: 1, note: "Individual step with status context" },
    { name: "StepperTrigger", indent: 2, note: "Clickable step header with indicator and label" },
    {
      name: "StepperContent",
      indent: 2,
      note: "Expandable content panel (substeps, custom content)",
    },
    { name: "StepperSubstep", indent: 3, note: "Nested substep with tag badge and status" },
    {
      name: "HorizontalStepper",
      indent: 0,
      note: "Sibling primitive: compact horizontal step bar",
    },
    {
      name: "HorizontalStepper.Step",
      indent: 1,
      note: "Single horizontal step (derives status from parent value)",
    },
  ],
  notes: [
    {
      title: "Visual variants (vertical)",
      content:
        "Five variants: ascii (default — mono 1ch bracket glyphs with blinking active cursor), numbered (CSS-counter square with ✓ on completed), bullet (single glyph with dashed connector), tag (uppercase text tag, no width shift on active), progress (Unicode block-element bar per step). All variants render the same six canonical states.",
    },
    {
      title: "Visual variants (horizontal)",
      content:
        "Three matching horizontal variants: ascii ([x] Init ─── [~] Build inline glyphs with solid connectors), numbered (Material-flavoured numbered square above a continuous 1px line with uppercase labels), breadcrumb (init / build › deploy slash separators with a caret on the active step).",
    },
    {
      title: "Six canonical states",
      content:
        "pending · active · completed · error · skipped · disabled. `skipped` ≠ `completed` (data integrity for form wizards). `disabled` ≠ `pending` (policy gate vs ordering). Skipped renders line-through. Disabled is non-interactive and skipped by arrow-key navigation.",
    },
    {
      title: "Keyboard model",
      content:
        "Single roving tab stop on the active step (falls back to the first non-disabled step). Arrow keys (Up/Down/Left/Right) cycle focus and skip disabled steps. Home/End jump to first/last enabled step. Editable targets inside step content keep their native handling.",
    },
    {
      title: "Expansion modes",
      content:
        "Supports controlled (expandedIds + onExpandedChange) and uncontrolled (defaultExpandedIds) expansion. Multiple steps can be expanded simultaneously.",
    },
    {
      title: "Composition contract",
      content:
        "Keep StepperTrigger and StepperContent as explicit children of StepperStep. StepperStep only links aria-controls when it can see a direct StepperContent child; opaque wrappers that create content internally are not part of the current public contract.",
    },
    {
      title: "Live region",
      content:
        "Active-step transitions are announced via a polite live region: 'Step {n} of {total}: {label}'. Label is sourced from the trigger's text content.",
    },
    {
      title: "Vertical vs horizontal",
      content:
        "Vertical Stepper carries rich expandable content, substeps, and per-step actions — use it for deploy pipelines, multi-step forms with detail, and onboarding flows. HorizontalStepper is a compact path bar (label-only) — use it for CI bars, wizard headers, and breadcrumb-style progress where vertical space is precious.",
    },
  ],
  usage: { example: "stepper-default" },
  companionExamples: ["horizontal-stepper"],
  examples: [
    { name: "stepper-default", title: "Default" },
    { name: "stepper-variants", title: "Variants" },
    { name: "stepper-variant-ascii", title: "Variant: ASCII" },
    { name: "stepper-variant-numbered", title: "Variant: Numbered" },
    { name: "stepper-variant-bullet", title: "Variant: Bullet" },
    { name: "stepper-variant-tag", title: "Variant: Tag" },
    { name: "stepper-variant-progress", title: "Variant: Progress" },
    { name: "stepper-state-matrix", title: "Six Canonical States" },
    { name: "stepper-auto-tone", title: "Auto Tone" },
    { name: "stepper-substeps", title: "With Substeps" },
    { name: "stepper-interactive", title: "Controlled Expansion" },
    { name: "stepper-custom", title: "Error States" },
    { name: "stepper-keyboard", title: "Keyboard Navigation" },
  ],
  keyboard: {
    description:
      "Roving tabIndex: a single Tab key reaches the stepper. Arrow keys (Up/Down/Left/Right) move focus between enabled steps and skip disabled ones. Home/End jump to the first/last enabled step. Enter or Space toggles direct StepperContent.",
    examples: [
      { name: "stepper-interactive", title: "Controlled expansion with keyboard" },
      { name: "stepper-keyboard", title: "Keyboard navigation" },
    ],
  },
  props: {
    Stepper: {
      variant: {
        type: '"ascii" | "numbered" | "bullet" | "tag" | "progress"',
        required: false,
        defaultValue: '"ascii"',
        description:
          "Visual variant. Controls the indicator glyph and connector treatment across every step.",
      },
      expandedIds: {
        type: "string[]",
        required: false,
        defaultValue: null,
        description: "Controlled set of currently expanded step ids.",
      },
      defaultExpandedIds: {
        type: "string[]",
        required: false,
        defaultValue: null,
        description: "Initial expanded ids for uncontrolled mode.",
      },
      onExpandedChange: {
        type: "(ids: string[]) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the expanded set changes.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "StepperStep children rendered inside an <ol>.",
      },
    },
    StepperStep: {
      stepId: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier matched against expandedIds.",
      },
      status: {
        type: '"pending" | "active" | "completed" | "error" | "skipped" | "disabled"',
        required: true,
        defaultValue: null,
        description:
          "Step status. Drives the indicator glyph, label styling, aria-current, aria-disabled, and tab-order eligibility.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "StepperTrigger and optional StepperContent.",
      },
    },
    StepperTrigger: {
      statusLabels: {
        type: 'Partial<Record<"pending" | "active" | "completed" | "error" | "skipped" | "disabled", string>>',
        required: false,
        defaultValue:
          '{ completed: "DONE", active: "RUN", pending: "WAIT", error: "FAIL", skipped: "SKIP", disabled: "OFF" }',
        description:
          'Per-status indicator label overrides. Used directly by `variant="tag"`; other variants use these labels as the screen-reader fallback for the indicator glyph.',
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Step label rendered next to the indicator glyph.",
      },
    },
    StepperContent: {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description:
          "Expandable content (e.g. nested StepperSubstep rows). Hidden, aria-hidden, and inert when collapsed.",
      },
    },
    StepperSubstep: {
      tag: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Short tag (e.g. step number or code) rendered inside a status-colored Badge.",
      },
      label: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Substep description.",
      },
      status: {
        type: '"pending" | "active" | "completed" | "error"',
        required: true,
        defaultValue: null,
        description:
          "Substep status. Substeps keep the original four-state lifecycle (skipped/disabled apply only to top-level steps).",
      },
      detail: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Trailing detail text. Overrides the status label fallback.",
      },
      statusLabels: {
        type: 'Partial<Record<"pending" | "active" | "completed" | "error", string>>',
        required: false,
        defaultValue: null,
        description: "Per-status fallback labels shown when detail is omitted.",
      },
    },
    HorizontalStepper: {
      variant: {
        type: '"ascii" | "numbered" | "breadcrumb"',
        required: false,
        defaultValue: '"ascii"',
        description:
          "Visual variant. Drives the indicator glyph, connector treatment, and label typography.",
      },
      steps: {
        type: "string[]",
        required: true,
        defaultValue: null,
        description:
          "Ordered step ids. Used to compute status (completed/active/pending) for each step relative to value.",
      },
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Id of the active step.",
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: '"Progress"',
        description: "Accessible name for the <ol> list.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "HorizontalStepper.Step children, one per id in steps.",
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
    },
  },
};
