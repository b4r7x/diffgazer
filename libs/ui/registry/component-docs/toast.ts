import type { ComponentDoc } from "./types";

export const toastDoc: ComponentDoc = {
  description:
    "Terminal-styled toast notification system. Imperative toast() API callable from anywhere. Supports tone shortcuts (severity), four layout variants, promise handling, and position-aware animations.",
  notes: [
    {
      title: "Imperative API",
      content:
        "Call toast(), toast.success(), toast.error(), toast.warning(), toast.info(), or toast.loading() from any code — no provider required. Place a <Toaster /> component in your app layout to render toasts.",
    },
    {
      title: "Tone vs Variant",
      content:
        "`tone` is severity (success/error/warning/info/loading) and drives color and ARIA role. `variant` is the layout shell: `card` (default, full payload), `hud` (single-line pill), `viewfinder` (corner brackets), `countdown` (card + auto-dismiss progress bar).",
    },
    {
      title: "Promise Support",
      content:
        "toast.promise(asyncFn, { loading, success, error }) shows a loading toast that updates to success or error when the promise resolves.",
    },
    {
      title: "Loading Toasts",
      content:
        "Loading toasts show a braille spinner and don't auto-dismiss. Use toast.loading() for manual control, or toast.promise() for automatic lifecycle.",
    },
    {
      title: "Error Toasts Persist",
      content: "Toasts with tone='error' do not auto-dismiss. Users must manually close them.",
    },
    {
      title: "Keyboard",
      content: "Press Escape to dismiss the most recent toast.",
    },
    {
      title: "Pause Behavior (WCAG 2.2.1)",
      content:
        "Auto-dismiss timers pause while the pointer hovers the toaster region, while focus is inside it (so action buttons stay reachable by keyboard), and while the document tab is hidden. Timers resume from the remaining time once interaction ends — users never lose time they could not see or read.",
    },
  ],
  anatomy: [
    { name: "Toaster", indent: 0, note: "Fixed-position container, subscribes to toast store" },
    {
      name: "Toast",
      indent: 1,
      note: "Individual toast notification with position-aware animation",
    },
  ],
  usage: { example: "toast-default" },
  examples: [
    { name: "toast-default", title: "All Tones" },
    { name: "toast-variants", title: "Layout Variants" },
    { name: "toast-actions", title: "With Actions" },
    { name: "toast-positions", title: "Positions" },
    { name: "toast-promise", title: "Promise" },
    { name: "toast-loading", title: "Loading" },
  ],
  keyboard: {
    description: "Press Escape to dismiss the most recent toast.",
    examples: [],
  },
  props: {
    Toaster: {
      position: {
        type: '"top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"',
        required: false,
        defaultValue: '"bottom-right"',
        description:
          "Corner where toasts stack. Drives positioning classes and slide-in direction.",
      },
    },
    "toast (function)": {
      title: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Primary toast title (first positional argument).",
      },
      tone: {
        type: '"success" | "error" | "warning" | "info" | "loading"',
        required: false,
        defaultValue: '"info"',
        description:
          "Severity tone. Drives icon, color, and auto-dismiss behavior (error and loading persist).",
      },
      variant: {
        type: '"card" | "hud" | "viewfinder" | "countdown"',
        required: false,
        defaultValue: '"card"',
        description:
          "Layout shell. `card` is the default two-row layout; `hud` is a single-line pill (no body/action); `viewfinder` has corner brackets; `countdown` adds an auto-dismiss progress bar.",
      },
      message: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "Secondary detail text below the title (rendered inline as muted text in `hud`).",
      },
      duration: {
        type: "number",
        required: false,
        defaultValue: "5000",
        description:
          "Auto-dismiss delay in ms. When action is set and duration is omitted, the toast persists indefinitely per WCAG 2.2.1.",
      },
      action: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Action element (e.g. a Button) rendered under the message. Ignored by `hud` (dev warning logged).",
      },
      id: {
        type: "string",
        required: false,
        defaultValue: "auto-generated",
        description:
          "Stable id for updating an existing toast (used by toast.promise to swap loading -> success/error).",
      },
    },
  },
};
