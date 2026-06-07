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
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "Accordion's arrow-key trigger navigation imports from the required @diffgazer/keys peer. Package/npm consumers need @diffgazer/keys as a peer after public packages are published. Before publication, validate package mode with a locally packed @diffgazer/keys tarball and use public package commands only after `npm view @diffgazer/keys version` succeeds. Importing @diffgazer/ui/components/accordion without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard helpers to local source.",
    },
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
    {
      title: "Region role (opt-in)",
      content:
        'AccordionContent accepts a region prop. When set, the open panel exposes role="region" with aria-labelledby pointing at its trigger. The APG accordion pattern lists this role as optional, so the default is off. Enable it for a small number of substantive panels (typically six or fewer) where each panel functions as its own landmark; leave it off when an accordion has many short items, since extra landmarks add noise to assistive-technology rotors.',
    },
  ],
  keyboard: {
    description:
      "Built-in keyboard navigation via @diffgazer/keys navigation helpers. Arrow Up/Down moves focus between accordion triggers, Home/End jumps to first/last, Enter/Space toggles the focused item.",
    examples: [{ name: "accordion-default", title: "Default (with keyboard support)" }],
  },
  usage: { example: "accordion-default" },
  examples: [
    { name: "accordion-default", title: "Default" },
    { name: "accordion-multiple", title: "Multiple Open" },
    { name: "accordion-custom-handle", title: "Custom Handle" },
  ],
  props: {
    Accordion: {
      type: {
        type: '"single" | "multiple"',
        required: false,
        defaultValue: '"single"',
        description: "Single allows one open item; multiple allows several open at once. Switches the value/onChange/defaultValue shape from string to string[].",
      },
      value: {
        type: "string | string[]",
        required: false,
        defaultValue: null,
        description: "Controlled open value(s). string for single mode, string[] for multiple.",
      },
      defaultValue: {
        type: "string | string[]",
        required: false,
        defaultValue: null,
        description: "Initial open value(s) for uncontrolled mode.",
      },
      onChange: {
        type: "(value: string | undefined) => void | (value: string[]) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the open value(s) change. Receives the next value; in single non-collapsible mode it never receives undefined.",
      },
      collapsible: {
        type: "boolean",
        required: false,
        defaultValue: "true (single mode)",
        description: 'Single mode only. When false, the currently open item cannot be closed by clicking it.',
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "AccordionItem children.",
      },
    },
    "Accordion.Item": {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier matched against the Accordion value.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables the item: trigger is not focusable and not toggleable.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Header and Content children.",
      },
    },
    "Accordion.Header": {
      as: {
        type: '"h2" | "h3" | "h4" | "h5" | "h6"',
        required: false,
        defaultValue: '"h3"',
        description: "Heading level wrapping the trigger.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Typically an Accordion.Trigger.",
      },
    },
    "Accordion.Trigger": {
      variant: {
        type: '"default" | "source"',
        required: false,
        defaultValue: '"default"',
        description: "Visual style. Source is a smaller variant used for inline source toggles.",
      },
      handle: {
        type: "ReactNode | null",
        required: false,
        defaultValue: "<Chevron open={isOpen} size=\"sm\" />",
        description: "Custom handle element. Pass null to hide the chevron entirely.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Trigger label.",
      },
    },
    "Accordion.Content": {
      region: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: 'Opt in to role="region" with aria-labelledby pointing at the trigger while the panel is open. Off by default per the APG accordion pattern (region is listed as optional). Enable for a small number of substantive panels (typically six or fewer); leave it off for many short items to avoid landmark noise.',
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Collapsible body content.",
      },
    },
  },
}
