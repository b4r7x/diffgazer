import type { HookDoc } from "@diffgazer/registry"

export const controllableStateDoc: HookDoc = {
  description:
    "Generic controlled/uncontrolled state hook. Manages value, defaultValue, and onChange for any component that supports both modes — like React's built-in input pattern, but reusable.",
  usage: {
    code: `const [value, setValue, isControlled] = useControllableState({
  value: props.value,
  defaultValue: props.defaultValue ?? "",
  onChange: props.onChange,
});`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "value",
      type: "T | undefined",
      required: false,
      description:
        "Controlled value. When provided, the component is in controlled mode.",
    },
    {
      name: "defaultValue",
      type: "T",
      required: true,
      description: "Initial value for uncontrolled mode.",
    },
    {
      name: "onChange",
      type: "(value: T) => void",
      required: false,
      description:
        "Called when the value changes, in both controlled and uncontrolled modes.",
    },
  ],
  returns: {
    type: "[T, (next: T | ((prev: T) => T)) => void, boolean]",
    description:
      "Tuple of [currentValue, setValue, isControlled]. The setter accepts both direct values and updater functions.",
    properties: [
      {
        name: "currentValue",
        type: "T",
        required: true,
        description:
          "The current value, whether controlled or uncontrolled.",
      },
      {
        name: "setValue",
        type: "(next: T | ((prev: T) => T)) => void",
        required: true,
        description:
          "State setter that works in both modes. Supports functional updates.",
      },
      {
        name: "isControlled",
        type: "boolean",
        required: true,
        description:
          "Whether the consumer is driving the value externally.",
      },
    ],
  },
  notes: [
    {
      title: "When to Use",
      content:
        "Use when building a component that should work both as controlled (value + onChange) and uncontrolled (defaultValue). It handles the state switching logic so the component doesn't need to.",
    },
    {
      title: "Return Value",
      content:
        "The isControlled flag tells you whether the consumer is driving the value externally. Use it for conditional logic like preventing internal state updates.",
    },
  ],
  examples: [
    { name: "controllable-state-basic", title: "Basic Input" },
    { name: "controllable-state-toggle", title: "Toggle" },
  ],
  tags: ["hook", "state", "controlled", "uncontrolled"],
}
