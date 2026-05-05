import type { ComponentDoc } from "./types"

export const calloutDoc: ComponentDoc = {
  description:
    "Dismissible alert box with semantic variants, auto-generated icons, and compound component architecture.",
  anatomy: [
    { name: "Callout", indent: 0, note: "Root (manages visibility state, provides variant context)" },
    { name: "CalloutIcon", indent: 1, note: "Variant icon with default characters (overridable via children)" },
    { name: "CalloutTitle", indent: 1, note: "Bold title text" },
    { name: "CalloutContent", indent: 1, note: "Body text" },
    { name: "CalloutDismiss", indent: 1, note: "Close button (triggers visibility change)" },
  ],
  notes: [
    {
      title: "Compound Components",
      content:
        "Use CalloutIcon, CalloutTitle, CalloutContent, and CalloutDismiss as children. Each part inherits the variant from the root Callout component via context.",
    },
    {
      title: "Layout",
      content:
        "Use the layout prop to control arrangement: 'column' (default) places icon on the left with title and content stacked vertically; 'inline' places everything in a single row that wraps when needed; 'none' removes all layout styles for full custom control. Note: with layout='none', sub-components still emit grid-column positioning classes (col-start-1, col-start-2, etc.) which are inert outside a grid parent but may need overriding if you set your own grid.",
    },
    {
      title: "Default Icons",
      content:
        "Each variant has a default icon character: info='i', warning='!', error='✕', success='✓'. Pass children to CalloutIcon to override with any ReactNode.",
    },
    {
      title: "Dismissible",
      content:
        "Add CalloutDismiss as a child to show a close button. In uncontrolled mode the callout self-dismisses. For controlled mode, pass visible and onVisibleChange to the root Callout.",
    },
    {
      title: "Accessibility",
      content:
        "Defaults to role='note' (static supplementary content). Override with role='alert' when the callout appears dynamically and needs to interrupt screen readers. Do not use role='alert' for callouts present on page load.",
    },
  ],
  usage: { example: "callout-default" },
  examples: [
    { name: "callout-default", title: "Default" },
    { name: "callout-variants", title: "Variants" },
    { name: "callout-controlled", title: "Controlled Visibility" },
    { name: "callout-custom-icon", title: "Custom Icon" },
  ],
  keyboard: null,
}
