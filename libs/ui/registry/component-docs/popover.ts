import type { ComponentDoc } from "./types"

export const popoverDoc: ComponentDoc = {
  description: "Floating content anchored to a trigger element. Supports click-to-open (popover) and hover (infotip) modes with full 4-side positioning, automatic flip, shift, and viewport collision detection. Zero external dependencies.",
  anatomy: [
    { name: "Popover", indent: 0, note: "Root — manages open state, trigger mode (click/hover), delay" },
    { name: "Popover.Trigger", indent: 1, note: "Element that activates the popover (click or hover)" },
    { name: "Popover.Content", indent: 1, note: "Portal-rendered positioned content with collision avoidance" },
  ],
  notes: [
    {
      title: "Trigger Modes",
      content: "Set `triggerMode=\"click\"` (default) for interactive popovers that toggle on click. Set `triggerMode=\"hover\"` for tooltip-like behavior with delay. Hover mode renders with `role=\"tooltip\"` and content stays open while the pointer hovers it.",
    },
    {
      title: "Positioning",
      content: "Content is positioned relative to the trigger with `side` (top/bottom/left/right), `align` (start/center/end), `sideOffset`, and `alignOffset`. When `avoidCollisions` is true (default), content flips to the opposite side if it would overflow, then tries cross-axis sides, then shifts within the viewport.",
    },
    {
      title: "Click Mode",
      content: "In click mode, the popover toggles on trigger click, dismisses on outside click or Escape key. Content is interactive (pointer-events enabled). Use for forms, menus, or rich content.",
    },
    {
      title: "Controlled",
      content: "Use `open` and `onOpenChange` props for controlled state. Works with both trigger modes.",
    },
    {
      title: "Portal Rendering",
      content: "Content renders via Portal at document.body level, escaping overflow:hidden ancestors and stacking contexts.",
    },
  ],
  usage: { example: "popover-basic" },
  examples: [
    { name: "popover-basic", title: "Basic" },
    { name: "popover-hover", title: "Hover Mode" },
    { name: "popover-placement", title: "Placement" },
    { name: "popover-controlled", title: "Controlled" },
  ],
  keyboard: {
    description: "In click mode, Escape closes the popover. Focus returns to the trigger element.",
    examples: [
      { name: "popover-basic", title: "Basic" },
    ],
  },
}
