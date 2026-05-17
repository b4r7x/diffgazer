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
  props: {
    HorizontalStepper: {
      steps: {
        type: "string[]",
        required: true,
        defaultValue: null,
        description: "Ordered step ids. Used to compute status (completed/active/pending) for each step relative to value.",
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
}
