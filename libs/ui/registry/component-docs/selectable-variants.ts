import type { ComponentDoc } from "./types"

export const selectableVariantsDoc: ComponentDoc = {
  description:
    "Shared CVA variant definitions for selectable list items. Provides consistent highlighted, disabled, size, and checked styling across checkbox, radio, and other selection components.",
  notes: [
    {
      title: "Exported Variants",
      content:
        "Exports four CVA variant functions and one constant: selectableVariants (root item), selectableContainerClass (inner flex layout string), selectableIndicatorVariants (check/radio indicator), selectableLabelVariants (label text), and selectableDescriptionVariants (description text).",
    },
    {
      title: "Highlight Indicator",
      content:
        "When highlighted is true, the item gets a bold left-edge bar (before pseudo-element) mimicking terminal-style selection. This is the visual cue for keyboard navigation focus.",
    },
    {
      title: "Size Variants",
      content:
        "Indicator and label support sm, md, and lg sizes. The indicator reserves minimum character width (3ch for sm, 4ch for md/lg) to keep alignment consistent across checked/unchecked states.",
    },
    {
      title: "Compound Variants",
      content:
        "The indicator uses a compound variant: checked + not highlighted renders in the success color. When highlighted, the foreground color takes precedence.",
    },
  ],
  usage: {
    code: `import {
  selectableVariants,
  selectableContainerClass,
  selectableIndicatorVariants,
  selectableLabelVariants,
} from "@/lib/selectable-variants";

<div className={selectableVariants({ highlighted, disabled })}>
  <div className={selectableContainerClass}>
    <span className={selectableIndicatorVariants({ size, checked, highlighted })}>
      {checked ? "[x]" : "[ ]"}
    </span>
    <span className={selectableLabelVariants({ size })}>{label}</span>
  </div>
</div>`,
    lang: "tsx",
  },
  tags: ["lib", "variants", "cva", "styling", "selectable"],
}
