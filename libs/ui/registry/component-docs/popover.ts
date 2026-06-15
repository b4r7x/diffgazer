import type { ComponentDoc } from "./types";

export const popoverDoc: ComponentDoc = {
  description:
    "Floating content anchored to a trigger element. Supports click-to-open (popover) and hover (infotip) modes with full 4-side positioning, automatic flip, shift, and viewport collision detection. Zero external dependencies.",
  anatomy: [
    {
      name: "Popover",
      indent: 0,
      note: "Root — manages open state, trigger mode (click/hover), delay",
    },
    {
      name: "Popover.Trigger",
      indent: 1,
      note: "Element that activates the popover (click or hover)",
    },
    {
      name: "Popover.Content",
      indent: 1,
      note: "Portal-rendered positioned content with collision avoidance",
    },
  ],
  notes: [
    {
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "Popover's auto-focus on open (focusing the first focusable element in the content) imports from the required @diffgazer/keys peer. Package/npm consumers need @diffgazer/keys as a peer after public packages are published. Before publication, validate package mode with a locally packed @diffgazer/keys tarball and use public package commands only after `npm view @diffgazer/keys version` succeeds. Importing @diffgazer/ui/components/popover without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the focusable helper to local source.",
    },
    {
      title: "Trigger Modes",
      content:
        'Set `triggerMode="click"` (default) for interactive popovers that toggle on click. Set `triggerMode="hover"` for tooltip-like behavior with delay. Hover mode renders with `role="tooltip"` and content stays open while the pointer hovers it.',
    },
    {
      title: "Positioning",
      content:
        "Content is positioned relative to the trigger with `side` (top/bottom/left/right), `align` (start/center/end), `sideOffset`, and `alignOffset`. When `avoidCollisions` is true (default), content flips to the opposite side if it would overflow, then tries cross-axis sides, then shifts within the viewport.",
    },
    {
      title: "Click Mode",
      content:
        "In click mode, the popover toggles on trigger click, dismisses on outside click, Escape, or focus leaving the trigger/content pair. Content is interactive (pointer-events enabled). Use for forms, menus, or rich content.",
    },
    {
      title: "Popup Role Contract",
      content:
        'popupRole controls the trigger aria-haspopup value and accepts dialog, menu, listbox, tree, or grid. Hover mode content renders role="tooltip" automatically; tooltip is not a popupRole value. Consumers remain responsible for matching the role to the content pattern and supplying an accessible name for dialog-like content.',
    },
    {
      title: "Controlled",
      content:
        "Use `open` and `onOpenChange` props for controlled state. Works with both trigger modes.",
    },
    {
      title: "Portal Rendering",
      content:
        "Content renders through the shared Portal primitive. When a PortalContainerProvider is present, Popover.Content uses that scoped container; otherwise it falls back to document.body. This keeps nested overlay trees in the same portal scope while still escaping overflow:hidden ancestors by default.",
    },
  ],
  usage: { example: "popover-basic" },
  examples: [
    { name: "popover-basic", title: "Basic" },
    { name: "popover-hover", title: "Hover Mode" },
    { name: "popover-placement", title: "Placement" },
    { name: "popover-menu", title: "Menu composition" },
    { name: "popover-controlled", title: "Controlled" },
  ],
  keyboard: {
    description:
      "Click-mode triggers toggle with pointer or keyboard activation. Escape closes open content and returns focus to the trigger. Dialog and menu content can auto-focus on open.",
    keys: [
      { keys: "Enter / Space", action: "Toggles the trigger in click mode." },
      {
        keys: "Escape",
        action: "Closes open click-mode content and returns focus to the trigger.",
      },
      {
        keys: "Tab / Shift+Tab",
        action:
          "Moves focus normally; click-mode content closes once focus leaves trigger and content.",
      },
    ],
    examples: [{ name: "popover-basic", title: "Basic" }],
  },
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "Popover.Content",
      values: '"open" | "closed"',
      description: "Presence state forwarded by FloatingPanel for enter/exit animation styling.",
    },
    {
      attribute: "data-side",
      appliesTo: "Popover.Content",
      values: '"top" | "right" | "bottom" | "left"',
      description: "Resolved side after collision handling.",
    },
    {
      attribute: "data-align",
      appliesTo: "Popover.Content",
      values: '"start" | "center" | "end"',
      description: "Resolved alignment after collision handling.",
    },
    {
      attribute: "data-positioned",
      appliesTo: "Popover.Content",
      values: "present after first measurement",
      description: "Marks content that has measured and can animate from its resolved origin.",
    },
  ],
  props: {
    Popover: {
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled open state. Pair with onOpenChange.",
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
      triggerMode: {
        type: '"click" | "hover"',
        required: false,
        defaultValue: '"click"',
        description:
          "Click toggles; hover opens on pointer/focus enter with a delay and closes on leave.",
      },
      popupRole: {
        type: '"dialog" | "menu" | "listbox" | "tree" | "grid"',
        required: false,
        defaultValue: null,
        description:
          "Overrides the aria-haspopup value applied to the trigger. Hover-mode tooltip content is selected by triggerMode, not popupRole.",
      },
      enabled: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "When false, the popover never opens and trigger handlers are no-ops.",
      },
      delayMs: {
        type: "number",
        required: false,
        defaultValue: "500",
        description: "Hover mode only. Delay before opening on hover or focus.",
      },
      closeDelayMs: {
        type: "number",
        required: false,
        defaultValue: "150 (hover) | 0 (click)",
        description: "Delay before closing after hover/focus leaves the trigger or content.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Popover.Trigger and Popover.Content subparts.",
      },
    },
    "Popover.Trigger": {
      children: {
        type: "ReactNode | (props: PopoverTriggerRenderProps) => ReactNode",
        required: true,
        defaultValue: null,
        description:
          "Trigger element. Pass a single element (cloned with merged ARIA/handlers), text (wrapped in <button>), or a render function for full control.",
      },
    },
    "Popover.Content": {
      role: {
        type: '"dialog" | "menu" | "listbox" | "tree" | "grid" | "tooltip"',
        required: false,
        defaultValue: null,
        description:
          'Popup ARIA role. Defaults to "tooltip" in hover mode. role="dialog" should have aria-label or aria-labelledby; a dev warning is logged and the content falls back to its fallback name when missing.',
      },
      side: {
        type: '"top" | "bottom" | "left" | "right"',
        required: false,
        defaultValue: '"bottom"',
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
        defaultValue: "6",
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
        description:
          "Flips to the opposite side, then cross-axis sides, then shifts within the viewport.",
      },
      collisionPadding: {
        type: "number",
        required: false,
        defaultValue: "8",
        description:
          "Minimum gap between the content and the viewport edge during collision avoidance.",
      },
      autoFocus: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description:
          'Dialog and menu roles only. When true, focuses the first focusable child on open (or the content itself for role="dialog" without a focusable child).',
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Popover body content.",
      },
    },
  },
};
