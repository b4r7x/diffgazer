import type { HookDoc } from "@diffgazer/registry";

export const formResetDoc: HookDoc = {
  description:
    "Keeps custom controls aligned with native form reset semantics without reporting uncontrolled resets as user changes.",
  usage: {
    code: `const inputRef = useRef<HTMLInputElement>(null);
const [value, setValue, , resetValue] = useControllableState({
  defaultValue,
  onChange: props.onChange,
});

const invalidatePendingReset = useFormReset(inputRef, defaultValue, resetValue);

const handleChange = (nextValue: string) => {
  invalidatePendingReset();
  setValue(nextValue);
};`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "ref",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description: "Element ref used to find the closest parent form.",
    },
    {
      name: "resetValue",
      type: "T",
      required: true,
      description: "Value passed to onReset when the parent form dispatches a native reset event.",
    },
    {
      name: "onReset",
      type: "(value: T) => void",
      required: true,
      description: "Called with resetValue when the parent form resets.",
    },
    {
      name: "isUncontrolled",
      type: "boolean",
      required: false,
      defaultValue: "true",
      description:
        "Set to false for controlled components. Controlled reset behavior can be provided separately.",
    },
    {
      name: "controlled",
      type: "{ syncResetBaseline: () => void; onReset: () => void } | undefined",
      required: false,
      description:
        "Optional handlers for custom controls that mirror native form state while externally controlled.",
    },
  ],
  returns: {
    type: "() => void",
    description: "Invalidates a queued reset before a later user or programmatic value mutation.",
  },
  notes: [
    {
      title: "Uncontrolled custom controls",
      content:
        "Pair this hook with useControllableState's resetValue setter. It restores the default internal value without calling the public onChange callback.",
    },
    {
      title: "Latest reset value",
      content:
        "The reset listener stays stable while reading the latest resetValue and onReset callback.",
    },
    {
      title: "Last mutation wins",
      content:
        "Call the returned invalidation function immediately before changing the control value so an older queued reset cannot overwrite the newer mutation.",
    },
  ],
  examples: [{ name: "form-reset-input", title: "Resettable Input" }],
  tags: ["hook", "form", "reset", "uncontrolled"],
};
