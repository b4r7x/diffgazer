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
      content: "Content renders via Portal at document.body level, so tooltips are never clipped by overflow:hidden ancestors. Position is calculated from trigger's bounding rect.",
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
}
