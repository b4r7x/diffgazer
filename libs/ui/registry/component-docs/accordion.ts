import type { ComponentDoc } from "./types"

export const accordionDoc: ComponentDoc = {
  description: "Collapsible content sections with single or multiple open items. Supports controlled and uncontrolled modes.",
  anatomy: [
    { name: "Accordion", indent: 0, note: "Root (manages open state, single or multiple mode)" },
    { name: "AccordionItem", indent: 1, note: "Wrapper for each collapsible section" },
    { name: "AccordionHeader", indent: 2, note: "Heading wrapper for trigger (h3 by default, configurable via as prop)" },
    { name: "AccordionTrigger", indent: 3, note: "Clickable button that toggles content" },
    { name: "AccordionContent", indent: 2, note: "Collapsible body region" },
  ],
  notes: [
    {
      title: "Single vs Multiple",
      content:
        "In single mode (default), only one item can be open. Set type='multiple' to allow several items open at once.",
    },
    {
      title: "Collapsible",
      content:
        "In single mode, collapsible defaults to true. Set collapsible={false} to always keep one item open.",
    },
    {
      title: "Keyboard Navigation",
      content:
        "Arrow Up/Down moves focus between triggers. Home/End jumps to first/last trigger. Enter or Space toggles the focused item. Navigation wraps around.",
    },
  ],
  keyboard: {
    description:
      "Built-in keyboard navigation via @diffgazer/keys useNavigation. Arrow Up/Down moves focus between accordion triggers, Home/End jumps to first/last, Enter/Space toggles the focused item.",
    examples: [{ name: "accordion-default", title: "Default (with keyboard support)" }],
  },
  usage: { example: "accordion-default" },
  examples: [
    { name: "accordion-default", title: "Default" },
    { name: "accordion-multiple", title: "Multiple Open" },
    { name: "accordion-custom-handle", title: "Custom Handle" },
  ],
}
