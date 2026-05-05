import type { ComponentDoc } from "./types"

export const controllableStateDoc: ComponentDoc = {
  description: "Generic controlled/uncontrolled state hook. Manages value, defaultValue, and onChange for any component that supports both modes — like React's built-in input pattern, but reusable.",
  notes: [
    {
      title: "When to Use",
      content: "Use useControllableState when building a component that should work both as a controlled component (value + onChange) and an uncontrolled component (defaultValue). It handles the state switching logic so the component doesn't need to.",
    },
    {
      title: "Return Value",
      content: "Returns a tuple [currentValue, setValue, isControlled]. The isControlled flag tells you whether the consumer is driving the value externally.",
    },
  ],
  usage: {
    code: `const [value, setValue, isControlled] = useControllableState({
  value: props.value,
  defaultValue: props.defaultValue ?? "",
  onChange: props.onChange,
});`,
    lang: "tsx",
  },
  tags: ["hook", "state", "controlled", "uncontrolled"],
}
