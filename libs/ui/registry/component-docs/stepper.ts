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
}
