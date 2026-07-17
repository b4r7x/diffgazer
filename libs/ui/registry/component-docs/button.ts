import type { ComponentDoc } from "./types";

export const buttonDoc: ComponentDoc = {
  description: "Terminal-inspired button with bracket notation and 8 variants.",
  notes: [
    {
      title: "Bracket Mode",
      content:
        "The bracket prop wraps the button label in [ ] characters, mimicking terminal UI conventions. When loading is true, bracket mode shows [ ... ] instead of [...].",
    },
    {
      title: "Polymorphic Element",
      content:
        'Use as="a" to render a semantic anchor element for navigation. The link variant is purely visual — combine it with as="a" for semantic anchor navigation.',
    },
    {
      title: "Render-Prop Composition",
      content:
        "Pass a function as children to control the rendered element. Button provides computed props, including an onClick activation guard. Spread them onto the rendered host so disabled and loading states prevent navigation for anchors and framework links.",
    },
  ],
  anatomy: [{ name: "Button", indent: 0, note: "Root button element" }],
  usage: { example: "button-default" },
  examples: [
    { name: "button-default", title: "Default" },
    { name: "button-variants", title: "Variants" },
    { name: "button-states", title: "States" },
    { name: "button-link", title: "Link (as anchor)" },
    { name: "button-render-prop", title: "Render-Prop" },
  ],
  keyboard: null,
  dataAttributes: [
    {
      attribute: "data-highlighted",
      appliesTo: "Button in button, anchor, and render-prop modes",
      values: "present when highlighted",
      description: "Marks the button as highlighted by a parent collection.",
    },
  ],
  props: {
    Button: {
      variant: {
        type: '"primary" | "secondary" | "destructive" | "success" | "ghost" | "outline" | "link" | "action"',
        required: false,
        defaultValue: '"primary"',
        description: "Visual style of the button.",
      },
      size: {
        type: '"sm" | "md" | "lg" | "icon"',
        required: false,
        defaultValue: '"md"',
        description: "Size token applied to height, padding, and font size.",
      },
      bracket: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Wraps the button label in [ ] characters for terminal-style emphasis. Switches to [ ... ] when loading is true.",
      },
      loading: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Shows a Spinner in place of the label and disables click activation.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables interaction; sets aria-disabled and stops onClick.",
      },
      highlighted: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Marks the button as currently highlighted by a parent collection (data-highlighted attribute).",
      },
      as: {
        type: '"button" | "a"',
        required: false,
        defaultValue: '"button"',
        description:
          'Render as a native <button> or as an <a> for navigation. The "link" variant is purely visual; combine it with as="a" for a semantic link.',
      },
      children: {
        type: "ReactNode | (renderProps: ButtonRenderProps) => ReactNode",
        required: true,
        defaultValue: null,
        description:
          "Button label, or a render function that receives computed props including the disabled/loading activation guard.",
      },
    },
  },
};
