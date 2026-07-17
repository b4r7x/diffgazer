import type { HookDoc } from "@diffgazer/registry";

export const controllableStateDoc: HookDoc = {
  description:
    "Generic controlled/uncontrolled state hook. Manages value, defaultValue, and onChange, with a separate silent setter for restoring uncontrolled native form state.",
  usage: {
    code: `const [value, setValue, isControlled, resetValue] = useControllableState({
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
      description: "Controlled value. When provided, the component is in controlled mode.",
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
      description: "Called when the value changes, in both controlled and uncontrolled modes.",
    },
    {
      name: "controlled",
      type: "boolean",
      required: false,
      description:
        "Forces controlled-mode detection when value can be undefined but the consumer still owns state.",
    },
  ],
  returns: {
    type: "[T, (next: T | ((prev: T) => T)) => void, boolean, (next: T) => void]",
    description:
      "Tuple of [currentValue, setValue, isControlled, resetValue]. The public setter accepts direct values and updater functions; resetValue silently restores uncontrolled internal state.",
    properties: [
      {
        name: "currentValue",
        type: "T",
        required: true,
        description: "The current value, whether controlled or uncontrolled.",
      },
      {
        name: "setValue",
        type: "(next: T | ((prev: T) => T)) => void",
        required: true,
        description: "State setter that works in both modes. Supports functional updates.",
      },
      {
        name: "isControlled",
        type: "boolean",
        required: true,
        description: "Whether the consumer is driving the value externally.",
      },
      {
        name: "resetValue",
        type: "(next: T) => void",
        required: true,
        description:
          "Updates uncontrolled internal state without calling onChange. It is a no-op in controlled mode.",
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
        "The isControlled flag reports external ownership. Use resetValue only for synchronization such as native form reset, where restoring an uncontrolled baseline must not emit a user change.",
    },
  ],
  examples: [
    { name: "controllable-state-basic", title: "Basic Input" },
    { name: "controllable-state-toggle", title: "Toggle" },
  ],
  tags: ["hook", "state", "controlled", "uncontrolled"],
};
