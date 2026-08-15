import type { ComponentDoc } from "./types.js";

export const emptyStateDoc: ComponentDoc = {
  description:
    "Composable placeholder content for empty views with centered and inline layout variants. Size propagates to all parts through the root's data-size attribute; variant controls root layout only.",
  anatomy: [
    {
      name: "EmptyState",
      indent: 0,
      note: "Root wrapper — stamps data-size, which every part reads through group-data variants. Variant controls root layout only.",
    },
    {
      name: "EmptyStateIcon",
      indent: 1,
      note: "Optional visual marker. Size adapts via the root's data-size.",
    },
    {
      name: "EmptyStateMessage",
      indent: 1,
      note: "Primary empty-state copy. Font size adapts via the root's data-size.",
    },
    {
      name: "EmptyStateDescription",
      indent: 1,
      note: "Secondary supporting copy. Font size adapts via the root's data-size.",
    },
    {
      name: "EmptyStateActions",
      indent: 1,
      note: "Optional action area for buttons/links. Gap adapts via the root's data-size.",
    },
    {
      name: "EmptyStateHint",
      indent: 1,
      note: "Quiet keyboard affordance for Kbd children. Non-interactive; font size adapts via the root's data-size.",
    },
  ],
  notes: [
    {
      title: "Layout Variants",
      content: "centered variant for full-page empty states, inline variant for embedded contexts.",
    },
    {
      title: "Size",
      content:
        "sm for compact embedded contexts, md (default) for standard use, lg for full-page empty states. Size propagates to all parts through the root's data-size attribute.",
    },
    {
      title: "Icon",
      content:
        "EmptyStateIcon scales its font size with the root size, so a text glyph or a currentColor icon inherits the theme in both palettes. Avoid color emoji: they render identically in light and dark and break the monochrome identity.",
    },
    {
      title: "Compound Composition",
      content:
        "Compose semantic parts for icon, message, description, and actions. There is no React context here: the root stamps data-size and every part reads it through group-data variants, so a copy-mode consumer must keep the root's group/es class. Variant controls root layout only.",
    },
    {
      title: "Keyboard Hint",
      content:
        "EmptyStateHint is the keyboard affordance: compose it with Kbd so an empty screen ends with the key that fills it instead of a full stop. It is deliberately non-interactive — on a touch surface there is no key to press, so render EmptyStateActions (a real button) there and let the Hint be the desktop affordance; the two compose, Actions above and Hint below. Kbd is a peer composition, so copy-mode consumers who never use the hint are not forced to pull it. The inline variant lays its root out as a row, so a Message + Hint pair needs flex-col on that instance to stack.",
    },
    {
      title: "Writing Empty States",
      content:
        "Name what is missing, name the action, name the key. Active voice, present tense, no apology and no 'oops'. Keep the hint to about three words — under live it is announced right after the message, so a sentence there becomes a paragraph in the ear.",
    },
    {
      title: "Accessibility",
      content:
        'For empty states that appear dynamically (e.g., after filtering returns no results), set live on the root. This adds role="status" and aria-live="polite" so screen readers announce the change. A live EmptyState must stay mounted across the results→empty transition: render it unconditionally (empty while results exist) and swap its children, instead of conditionally mounting it already containing its message — many screen-reader/browser pairs do not announce a live region inserted with content already inside it.',
    },
  ],
  usage: { example: "empty-state-default" },
  examples: [
    { name: "empty-state-default", title: "Default" },
    { name: "empty-state-variants", title: "Variants" },
    { name: "empty-state-hint", title: "Keyboard hint" },
    { name: "empty-state-live", title: "Dynamic (live)" },
  ],
  keyboard: null,
  props: {
    EmptyState: {
      variant: {
        type: '"centered" | "inline"',
        required: false,
        defaultValue: '"centered"',
        description:
          "Root layout. Centered stacks children vertically; inline aligns them horizontally.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description:
          "Spacing and font-size scale propagated to all subparts via data-size attribute.",
      },
      live: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          'When true, adds role="status" and aria-live="polite" so screen readers announce the empty state. Keep a live EmptyState mounted across the results→empty transition (render it unconditionally, empty while results exist, and swap its children) rather than conditionally mounting it with its message already inside.',
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "EmptyState subparts (Icon, Message, Description, Actions).",
      },
    },
    EmptyStateIcon: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Visual marker. Always rendered with aria-hidden.",
      },
    },
    EmptyStateMessage: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Primary empty-state copy.",
      },
    },
    EmptyStateDescription: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Supporting copy.",
      },
    },
    EmptyStateActions: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Action buttons or links.",
      },
    },
    EmptyStateHint: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Keyboard affordance copy, typically Kbd chips plus two or three words.",
      },
    },
  },
};
