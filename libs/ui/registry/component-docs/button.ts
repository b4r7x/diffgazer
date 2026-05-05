import type { ComponentDoc } from "./types"

export const buttonDoc: ComponentDoc = {
  description: "Terminal-inspired button with bracket notation and 8 variants.",
  notes: [
    {
      title: "Bracket Mode",
      content: "The bracket prop wraps the button label in [ ] characters, mimicking terminal UI conventions. When loading is true, bracket mode shows [ ... ] instead of [...].",
    },
    {
      title: "Polymorphic Element",
      content: "Use as=\"a\" to render a semantic anchor element for navigation. The link variant is purely visual — combine it with as=\"a\" for semantic anchor navigation.",
    },
    {
      title: "Render-Prop Composition",
      content: "Pass a function as children to control the rendered element. Button provides computed props (className, disabled, ARIA attributes) and the consumer renders any element or component. Use for Next.js Link, React Router NavLink, or other custom components.",
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
}
