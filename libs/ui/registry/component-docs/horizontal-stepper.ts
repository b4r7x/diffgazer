import type { ComponentDoc } from "./types"

export const horizontalStepperDoc: ComponentDoc = {
  description:
    "Compact horizontal step indicator with dash-connected labels.",
  notes: [
    {
      title: "Compound Component",
      content:
        "Set value to the current step id and use HorizontalStepper.Step (or named Step import) for each step. Each step receives its status (active/completed/pending) via context. Use useStepInfo() to build fully custom step components.",
    },
  ],
  usage: { example: "horizontal-stepper-default" },
  examples: [
    { name: "horizontal-stepper-default", title: "Default" },
    { name: "horizontal-stepper-progress", title: "Progress" },
  ],
  keyboard: null,
}
