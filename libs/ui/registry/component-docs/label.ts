import type { ComponentDoc } from "./types";

export const labelDoc: ComponentDoc = {
  description:
    "Styled label with optional form control wrapping. Standalone mode renders colored uppercase text. Wrapper mode (via label prop) renders the label above or beside children content.",
  notes: [
    {
      title: "Standalone vs Wrapper Mode",
      content:
        "Without the label prop, Label renders as a simple styled <label> with colored uppercase text. With the label prop, it wraps children in a flex container — the label becomes a <span> above (or beside) the child content.",
    },
    {
      title: "Orientation",
      content:
        "In wrapper mode, orientation controls layout direction. Vertical (default) stacks the label above children with a small gap. Horizontal places them side-by-side, useful for checkbox-style layouts.",
    },
    {
      title: "Native Label Wrapping",
      content:
        "Both modes render a native <label> element. In wrapper mode, the label wraps the form control — this provides implicit association without needing htmlFor/id pairs.",
    },
    {
      title: "Disabled State",
      content:
        "Label automatically dims when its associated form control is disabled. In wrapper mode, has-[:disabled] detects a disabled descendant. In standalone mode (sibling placement), peer-disabled detects a disabled peer element.",
    },
  ],
  usage: { example: "label-default" },
  examples: [
    { name: "label-default", title: "Default" },
    { name: "label-wrapper", title: "Wrapper" },
    { name: "label-horizontal", title: "Horizontal" },
    { name: "label-colors", title: "Colors" },
    { name: "label-disabled", title: "Disabled" },
  ],
  keyboard: null,
  props: {
    Label: {
      color: {
        type: '"default" | "primary" | "success" | "warning" | "error"',
        required: false,
        defaultValue: '"default"',
        description: "Color token applied to the label text.",
      },
      label: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "When set, switches to wrapper mode: renders the label text alongside children inside a single native <label>.",
      },
      orientation: {
        type: '"vertical" | "horizontal"',
        required: false,
        defaultValue: '"vertical"',
        description:
          "Wrapper-mode layout direction. Vertical stacks the label above; horizontal places it inline.",
      },
      required: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Appends a destructive-colored required indicator after the label text.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Text content (standalone mode) or the wrapped form control (wrapper mode).",
      },
    },
  },
};
