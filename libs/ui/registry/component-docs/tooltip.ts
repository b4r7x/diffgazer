import type { ComponentDoc } from "./types"

export const tooltipDoc: ComponentDoc = {
  description: "Minimal tooltip with hover delay and terminal styling. Built on the Popover primitive with full 4-side positioning and collision avoidance. Shows contextual information on hover without clipping by overflow ancestors.",
  anatomy: [
    { name: "Tooltip", indent: 0, note: "Root — manages hover state, delay, and enabled toggle" },
    { name: "Tooltip.Trigger", indent: 1, note: "Element that activates the tooltip on hover/focus" },
    { name: "Tooltip.Content", indent: 1, note: "Portal-rendered positioned content" },
  ],
  notes: [
    {
      title: "Shorthand",
      content: "Use the `content` prop on Tooltip root for simple text tooltips without compound nesting: `<Tooltip content=\"Help text\"><button>…</button></Tooltip>`.",
    },
    {
      title: "Positioning",
      content: "Content supports all four sides via the `side` prop: `top` (default), `bottom`, `left`, `right`. Use `align` (`start`, `center`, `end`) for cross-axis alignment. Automatic flip and shift when content would overflow the viewport.",
    },
    {
      title: "Portal Rendering",
      content: "Content renders through the shared Portal primitive. When a PortalContainerProvider is present, Tooltip.Content uses that scoped container; otherwise it falls back to document.body. This keeps nested overlay trees in the same portal scope while still escaping overflow:hidden ancestors by default.",
    },
    {
      title: "Conditional Display",
      content: "Use the `enabled` prop to conditionally disable the tooltip without unmounting. Pairs well with useOverflow — only show tooltip when content is actually truncated.",
    },
    {
      title: "Delay",
      content: "Default show delay is 500ms (hover intent). Hide is instant. Customize via `delayMs` prop.",
    },
    {
      title: "Built on Popover",
      content: "Tooltip is a thin wrapper around the Popover primitive with `triggerMode=\"hover\"`. For interactive floating content, use Popover directly.",
    },
    {
      title: "Controlled Mode",
      content: "Supports `open`, `defaultOpen`, and `onOpenChange` props for programmatic control: `<Tooltip content=\"Help\" open={showHelp} onOpenChange={setShowHelp}>...</Tooltip>`.",
    },
  ],
  usage: { example: "tooltip-basic" },
  examples: [
    { name: "tooltip-basic", title: "Basic" },
    { name: "tooltip-placement", title: "Placement" },
    { name: "tooltip-interactive", title: "Interactive Triggers" },
  ],
  keyboard: {
    description: "Tooltip shows on focus and hides on blur, so Tab into the trigger reveals the tooltip. Escape dismisses the tooltip and returns focus to the trigger.",
    examples: [
      { name: "tooltip-interactive", title: "Interactive triggers with keyboard" },
    ],
  },
  props: {
    Tooltip: {
      content: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: 'Shorthand: when set, Tooltip renders children inside Tooltip.Trigger and content inside Tooltip.Content automatically. When omitted, compose Tooltip.Trigger and Tooltip.Content explicitly via children.',
      },
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled open state.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Initial open state for uncontrolled mode.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the open state changes.",
      },
      enabled: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Disables hover/focus triggering when false (use to suppress tooltips conditionally).",
      },
      delayMs: {
        type: "number",
        required: false,
        defaultValue: "500",
        description: "Show delay after pointer/focus enters the trigger.",
      },
      closeDelayMs: {
        type: "number",
        required: false,
        defaultValue: "150",
        description: "Hide delay after pointer/focus leaves the trigger or content.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Trigger element (shorthand mode) or full Tooltip.Trigger/Tooltip.Content composition.",
      },
    },
    "Tooltip.Trigger": {
      children: {
        type: "ReactNode | (props: PopoverTriggerRenderProps) => ReactNode",
        required: true,
        defaultValue: null,
        description: "Trigger element. Same render-prop and clone semantics as Popover.Trigger.",
      },
    },
    "Tooltip.Content": {
      side: {
        type: '"top" | "bottom" | "left" | "right"',
        required: false,
        defaultValue: '"top"',
        description: "Preferred side relative to the trigger.",
      },
      align: {
        type: '"start" | "center" | "end"',
        required: false,
        defaultValue: '"center"',
        description: "Alignment along the chosen side.",
      },
      sideOffset: {
        type: "number",
        required: false,
        defaultValue: "4",
        description: "Pixel gap from the trigger along the side axis.",
      },
      alignOffset: {
        type: "number",
        required: false,
        defaultValue: "0",
        description: "Pixel offset along the alignment axis.",
      },
      avoidCollisions: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Flip and shift to keep the tooltip inside the viewport.",
      },
      collisionPadding: {
        type: "number",
        required: false,
        defaultValue: "8",
        description: "Minimum gap between the tooltip and the viewport edge.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Tooltip body content.",
      },
    },
  },
}
