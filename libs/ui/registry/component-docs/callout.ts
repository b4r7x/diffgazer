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
        "Add CalloutDismiss as a child to show a close button. In uncontrolled mode the callout self-dismisses. For controlled mode, pass open and onOpenChange to the root Callout.",
    },
    {
      title: "Accessibility",
      content:
        "Static callouts do not set a role by default, except variant='error' which renders role='alert'. Pass live to render status semantics for info, warning, and success callouts that appear dynamically. You may still pass a native role prop when a specific landmark or live-region contract is needed.",
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
  props: {
    Callout: {
      variant: {
        type: '"info" | "warning" | "error" | "success"',
        required: false,
        defaultValue: '"info"',
        description: "Semantic color and default icon set.",
      },
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled visibility state. Pair with onOpenChange.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Initial visibility state for uncontrolled usage.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Called when CalloutDismiss closes the callout or controlled state should change.",
      },
      layout: {
        type: '"column" | "inline" | "none"',
        required: false,
        defaultValue: '"column"',
        description: "Layout preset for icon, title, content, and dismiss button.",
      },
      live: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Adds live-region semantics for non-error callouts. Error callouts are alerts by default.",
      },
    },
    CalloutIcon: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: "variant icon",
        description: "Custom icon content. The icon is decorative and aria-hidden.",
      },
    },
    CalloutTitle: {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Title text for the callout.",
      },
    },
    CalloutContent: {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Body content for the callout.",
      },
    },
    CalloutDismiss: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: '"[x]"',
        description: "Custom dismiss button content.",
      },
    },
  },
}
