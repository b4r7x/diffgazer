import type { ComponentDoc } from "./types"

export const labelDoc: ComponentDoc = {
  description:
    "Styled label with optional form control wrapping. Standalone mode renders colored uppercase text. Wrapper mode (via text prop) renders label above or beside children content.",
  notes: [
    {
      title: "Standalone vs Wrapper Mode",
      content:
        "Without the text prop, Label renders as a simple styled <label> with colored uppercase text. With the text prop, it wraps children in a flex container — the text becomes a <span> above (or beside) the child content.",
    },
    {
      title: "Orientation",
      content:
        "In wrapper mode, orientation controls layout direction. Vertical (default) stacks label text above children with a small gap. Horizontal places them side-by-side, useful for checkbox-style layouts.",
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
}
