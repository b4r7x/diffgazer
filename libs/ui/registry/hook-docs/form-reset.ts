import type { HookDoc } from "@diffgazer/registry"

export const formResetDoc: HookDoc = {
  description:
    "Resets uncontrolled custom control state when a parent native form is reset.",
  usage: {
    code: `const inputRef = useRef<HTMLInputElement>(null);
const [value, setValue] = useState(defaultValue);

useFormReset(inputRef, defaultValue, setValue, value === undefined);`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "ref",
      type: "RefObject<HTMLElement | null>",
      required: true,
      description:
        "Element ref used to find the closest parent form.",
    },
    {
      name: "resetValue",
      type: "T",
      required: true,
      description:
        "Value passed to onReset when the parent form dispatches a native reset event.",
    },
    {
      name: "onReset",
      type: "(value: T) => void",
      required: true,
      description:
        "Called with resetValue when the parent form resets.",
    },
    {
      name: "enabled",
      type: "boolean",
      required: false,
      defaultValue: "true",
      description:
        "Set to false for controlled components or when native form reset integration should be disabled.",
    },
  ],
  returns: {
    type: "void",
    description:
      "Registers a reset listener on the closest parent form while enabled.",
  },
  notes: [
    {
      title: "Uncontrolled custom controls",
      content:
        "Use this hook when a custom control mirrors native input behavior and should return to its default value on form reset.",
    },
    {
      title: "Latest reset value",
      content:
        "The reset listener stays stable while reading the latest resetValue and onReset callback.",
    },
  ],
  examples: [
    { name: "form-reset-input", title: "Resettable Input" },
  ],
  tags: ["hook", "form", "reset", "uncontrolled"],
}
