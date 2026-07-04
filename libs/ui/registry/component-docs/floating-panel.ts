import type { ComponentDoc } from "./types";

export const floatingPanelDoc: ComponentDoc = {
  description:
    "Headless floating surface primitive. Composes Portal, presence, and floating-position to render an anchored, animated panel with data-state, data-side, data-align, and data-positioned attributes plus a transform-origin custom property. Used by Popover, Select, and other anchored surfaces.",
  notes: [
    {
      title: "Headless and Controlled",
      content:
        "FloatingPanel never closes itself. There is no defaultOpen. Wrap it in a primitive that owns dismiss (outside-click, escape, focus management) and forward the resolved boolean to `open`.",
    },
    {
      title: "Positioning",
      content:
        "Resolves placement against `triggerRef` with `side`, `align`, `sideOffset`, and `alignOffset`. When `avoidCollisions` is true (default), the panel flips to the opposite side, then cross-axis sides, then shifts within the viewport. Final values land on `data-side` and `data-align`.",
    },
    {
      title: "CSS Custom Properties",
      content:
        "Always writes `--ui-content-transform-origin` derived from the resolved side/align plus `--floating-panel-available-height` and `--floating-panel-available-width` for capping overflow. When `matchTriggerWidth` is true, also writes `--ui-floating-trigger-width`. The `.ui-floating-panel` rule reads `--ui-floating-z` (default `var(--z-popover)`) for its z-index layer, so consumers can scope-override z without className overrides. Consumers can read or override these on the panel or an ancestor.",
    },
    {
      title: "Style Merging",
      content:
        "Caller `style` merges before internal positioning styles. Structural keys (`position`, `top`, `left`, `visibility`, `--ui-content-transform-origin`, `--floating-panel-available-height`, `--floating-panel-available-width`, `--ui-floating-trigger-width`) cannot be overridden; everything else (background, min-width, border, transform, etc.) passes through.",
    },
    {
      title: "Accessibility",
      content:
        "FloatingPanel renders a bare div. Consumers must supply a role (e.g. `dialog`, `menu`) and an accessible name (`aria-label` or `aria-labelledby`).",
    },
    {
      title: "Context",
      content:
        "Descendants of the rendered panel can subscribe to positioning state via `useFloatingPanelContext()`. Useful for adapters that need to defer effects (focus, measurement) until after the first measure.",
    },
  ],
  usage: { example: "floating-panel-default" },
  examples: [
    { name: "floating-panel-default", title: "Anchored panel" },
    { name: "floating-panel-custom-menu", title: "Custom menu" },
  ],
  keyboard: null,
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "FloatingPanel",
      values: '"open" | "closed"',
      description: "Presence state for enter and exit animation selectors.",
    },
    {
      attribute: "data-side",
      appliesTo: "FloatingPanel",
      values: '"top" | "right" | "bottom" | "left"',
      description: "Resolved side after collision handling.",
    },
    {
      attribute: "data-align",
      appliesTo: "FloatingPanel",
      values: '"start" | "center" | "end"',
      description: "Resolved alignment after collision handling.",
    },
    {
      attribute: "data-positioned",
      appliesTo: "FloatingPanel",
      values: "present after first measurement",
      description:
        "Marks a measured panel so adapters can defer effects until positioning is stable.",
    },
  ],
  cssVariables: [
    {
      name: "--ui-content-transform-origin",
      description: "Computed transform origin matching the resolved side and alignment.",
    },
    {
      name: "--ui-floating-trigger-width",
      description: "Trigger width in pixels when matchTriggerWidth is true.",
    },
    {
      name: "--floating-panel-available-height",
      description:
        "Available height before viewport overflow. Use as max-height with overflow-y: auto.",
    },
    {
      name: "--floating-panel-available-width",
      description:
        "Available width before viewport overflow. Use as max-width with overflow-x: auto.",
    },
    {
      name: "--ui-floating-z",
      description: "Layer token read by .ui-floating-panel for z-index.",
      defaultValue: "var(--z-popover)",
    },
  ],
  props: {
    FloatingPanel: {
      open: {
        type: "boolean",
        required: true,
        defaultValue: null,
        description:
          "Controlled open state. FloatingPanel never closes itself; the wrapping primitive owns dismiss and forwards the resolved boolean here.",
      },
      triggerRef: {
        type: "RefObject<HTMLElement | null>",
        required: true,
        defaultValue: null,
        description: "Anchor element the panel positions against. Must be a stable RefObject.",
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
          "Minimum gap between the panel and the viewport edge during collision avoidance.",
      },
      matchTriggerWidth: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "When true, exposes `--ui-floating-trigger-width` on the panel so callers can size the panel against the trigger (use as `width`, `min-width`, or `max-width`).",
      },
      exitFallbackMs: {
        type: "number",
        required: false,
        defaultValue: "1000",
        description:
          "Max ms to wait for `animationend` before forcing unmount. Raise to at least 2× `--ui-content-exit-duration` if you customize that token past 500ms.",
      },
      portalContainer: {
        type: "Element | null",
        required: false,
        defaultValue: null,
        description:
          "Explicit portal target forwarded to Portal. Falls back to the ambient PortalContainerProvider scope, then the scoped container's `ownerDocument.body`, then `document.body`.",
      },
      onExitComplete: {
        type: "() => void",
        required: false,
        defaultValue: null,
        description:
          "Fired after the exit animation resolves (or the fallback timer fires) and the panel unmounts.",
      },
      style: {
        type: "CSSProperties",
        required: false,
        defaultValue: null,
        description:
          "Caller styles merged before internal positioning styles. Structural keys cannot be overridden; pass-through keys (background, border, transform, etc.) apply.",
      },
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Additional class names merged after the default `ui-floating-panel` class.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Panel body content.",
      },
      ref: {
        type: "Ref<HTMLDivElement>",
        required: false,
        defaultValue: null,
        description:
          "Forwarded ref to the panel element. Composed with the internal measurement ref.",
      },
    },
    useFloatingPanelContext: {
      positioned: {
        type: "boolean",
        required: true,
        defaultValue: null,
        description:
          "True once the panel has measured against its trigger; false during the first paint and after the exit animation. Use to defer effects (focus, measurement) until after the first measure.",
      },
      side: {
        type: '"top" | "bottom" | "left" | "right" | null',
        required: true,
        defaultValue: null,
        description: "Resolved side after collision handling. Null before the first measure.",
      },
      align: {
        type: '"start" | "center" | "end" | null',
        required: true,
        defaultValue: null,
        description: "Resolved align after collision handling. Null before the first measure.",
      },
    },
  },
};
