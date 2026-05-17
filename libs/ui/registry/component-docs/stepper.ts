import type { ComponentDoc } from "./types"

export const stepperDoc: ComponentDoc = {
  description: "Step-by-step progress indicator with expandable steps, substeps, and status badges. Compound component with context-based state management.",
  anatomy: [
    { name: "Stepper", indent: 0, note: "Root provider (manages expansion state)" },
    { name: "StepperStep", indent: 1, note: "Individual step with status context" },
    { name: "StepperTrigger", indent: 2, note: "Clickable step header with badge and label" },
    { name: "StepperContent", indent: 2, note: "Expandable content panel (substeps, custom content)" },
    { name: "StepperSubstep", indent: 3, note: "Nested substep with tag badge and status" },
  ],
  notes: [
    {
      title: "Expansion Modes",
      content: "Supports controlled (expandedIds + onExpandedChange) and uncontrolled (defaultExpandedIds) expansion. Multiple steps can be expanded simultaneously.",
    },
    {
      title: "Composition Contract",
      content: "Keep StepperTrigger and StepperContent as explicit children of StepperStep. StepperStep only links aria-controls when it can see a direct StepperContent child; opaque wrappers that create content internally are not part of the current public contract.",
    },
  ],
  usage: { example: "stepper-default" },
  examples: [
    { name: "stepper-default", title: "Default" },
    { name: "stepper-substeps", title: "With Substeps" },
    { name: "stepper-interactive", title: "Controlled Expansion" },
    { name: "stepper-custom", title: "Error States" },
    { name: "stepper-keyboard", title: "Keyboard Navigation" },
  ],
  keyboard: {
    description:
      "All step triggers render as focusable buttons. Press Enter or Space to toggle direct StepperContent. Steps without a direct StepperContent child have no visible content panel and do not expose aria-controls.",
    examples: [
      { name: "stepper-interactive", title: "Controlled expansion with keyboard" },
      { name: "stepper-keyboard", title: "Keyboard navigation" },
    ],
  },
  props: {
    Stepper: {
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
        type: '"completed" | "active" | "pending" | "error"',
        required: true,
        defaultValue: null,
        description: "Step status, used for badge color, label styling, and aria-current.",
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
        type: "Partial<Record<\"completed\" | \"active\" | \"pending\" | \"error\", string>>",
        required: false,
        defaultValue: '{ completed: "Completed", active: "Active", pending: "Pending", error: "Error" }',
        description: "Per-status badge label overrides.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Step label rendered next to the status badge.",
      },
    },
    StepperContent: {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Expandable content (e.g. nested StepperSubstep rows). Hidden, aria-hidden, and inert when collapsed.",
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
        description: "Substep status. Affects color and badge tone.",
      },
      detail: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Trailing detail text. Overrides the status label fallback.",
      },
      statusLabels: {
        type: "Partial<Record<\"pending\" | \"active\" | \"completed\" | \"error\", string>>",
        required: false,
        defaultValue: null,
        description: "Per-status fallback labels shown when detail is omitted.",
      },
    },
  },
}
