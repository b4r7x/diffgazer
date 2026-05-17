import type { ComponentDoc } from "./types"

export const emptyStateDoc: ComponentDoc = {
  description:
    "Composable placeholder content for empty views with centered and inline layout variants. Size propagates to all parts via context; variant controls root layout only.",
  anatomy: [
    { name: "EmptyState", indent: 0, note: "Root wrapper — provides size context to all parts. Variant controls root layout only." },
    { name: "EmptyStateIcon", indent: 1, note: "Optional visual marker. Size adapts via context." },
    { name: "EmptyStateMessage", indent: 1, note: "Primary empty-state copy. Font size adapts via context." },
    { name: "EmptyStateDescription", indent: 1, note: "Secondary supporting copy. Font size adapts via context." },
    { name: "EmptyStateActions", indent: 1, note: "Optional action area for buttons/links. Gap adapts via context." },
  ],
  notes: [
    {
      title: "Layout Variants",
      content:
        "centered variant for full-page empty states, inline variant for embedded contexts.",
    },
    {
      title: "Size",
      content:
        "sm for compact embedded contexts, md (default) for standard use, lg for full-page empty states. Size propagates to all parts via context.",
    },
    {
      title: "Compound Composition",
      content:
        "Compose semantic parts for icon, message, description, and actions. All parts consume size from the root via React context. Variant controls root layout only.",
    },
    {
      title: "Accessibility",
      content:
        "For empty states that appear dynamically (e.g., after filtering returns no results), set live on the root. This adds role=\"status\" and aria-live=\"polite\" so screen readers announce the change.",
    },
  ],
  usage: { example: "empty-state-default" },
  examples: [
    { name: "empty-state-default", title: "Default" },
    { name: "empty-state-variants", title: "Variants" },
    { name: "empty-state-live", title: "Dynamic (live)" },
  ],
  keyboard: null,
  props: {
    EmptyState: {
      variant: {
        type: '"centered" | "inline"',
        required: false,
        defaultValue: '"centered"',
        description: "Root layout. Centered stacks children vertically; inline aligns them horizontally.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Spacing and font-size scale propagated to all subparts via data-size attribute.",
      },
      live: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: 'When true, adds role="status" and aria-live="polite" so screen readers announce the empty state.',
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
  },
}
