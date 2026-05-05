import type { ComponentDoc } from "./types"

export const portalDoc: ComponentDoc = {
  description:
    "Renders children into a DOM node outside the parent hierarchy using React's createPortal. Useful for escaping overflow, z-index, and stacking context constraints.",
  anatomy: [
    { name: "Portal", indent: 0, note: "Renders children into document.body or a custom container element" },
  ],
  notes: [
    {
      title: "When to Use",
      content:
        "Use Portal when content needs to visually break out of its parent — for example, dropdowns inside scroll containers, tooltips that shouldn't be clipped, or custom modals. Dialog, CommandPalette, and Popover use Portal internally.",
    },
    {
      title: "SSR Safety",
      content:
        "Portal returns null when document is unavailable (server-side rendering). No additional guards needed.",
    },
    {
      title: "Custom Container",
      content:
        "Pass a container prop to render into a specific DOM element instead of document.body. Useful for scoped rendering or testing.",
    },
  ],
  usage: { example: "portal-default" },
  examples: [
    { name: "portal-default", title: "Default" },
    { name: "portal-custom-container", title: "Custom Container" },
  ],
  keyboard: null,
}
