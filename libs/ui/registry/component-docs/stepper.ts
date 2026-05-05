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
      "All steps render as focusable buttons. Press Enter or Space to toggle the expanded content. Steps without a Content child still toggle expansion state but have no visible content panel.",
    examples: [
      { name: "stepper-interactive", title: "Controlled expansion with keyboard" },
      { name: "stepper-keyboard", title: "Keyboard navigation" },
    ],
  },
}
