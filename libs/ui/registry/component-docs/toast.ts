import type { ComponentDoc } from "./types"

export const toastDoc: ComponentDoc = {
  description: "Terminal-styled toast notification system. Imperative toast() API callable from anywhere. Supports variant shortcuts, promise handling, and position-aware animations.",
  notes: [
    {
      title: "Imperative API",
      content: "Call toast(), toast.success(), toast.error(), toast.warning(), toast.info(), or toast.loading() from any code — no provider required. Place a <Toaster /> component in your app layout to render toasts.",
    },
    {
      title: "Promise Support",
      content: "toast.promise(asyncFn, { loading, success, error }) shows a loading toast that updates to success or error when the promise resolves.",
    },
    {
      title: "Loading Toasts",
      content: "Loading toasts show a braille spinner and don't auto-dismiss. Use toast.loading() for manual control, or toast.promise() for automatic lifecycle.",
    },
    {
      title: "Error Toasts Persist",
      content: "Toasts with variant='error' do not auto-dismiss. Users must manually close them.",
    },
    {
      title: "Keyboard",
      content: "Press Escape to dismiss the most recent toast.",
    },
  ],
  anatomy: [
    { name: "Toaster", indent: 0, note: "Fixed-position container, subscribes to toast store" },
    { name: "Toast", indent: 1, note: "Individual toast notification with position-aware animation" },
  ],
  usage: { example: "toast-default" },
  examples: [
    { name: "toast-default", title: "All Variants" },
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
        description: "Corner where toasts stack. Drives positioning classes and slide-in direction.",
      },
    },
    "toast (function)": {
      title: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Primary toast title (first positional argument).",
      },
      variant: {
        type: '"info" | "success" | "warning" | "error" | "loading"',
        required: false,
        defaultValue: '"info"',
        description: "Toast variant. Drives icon, color, and auto-dismiss behavior (error and loading persist).",
      },
      message: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Secondary detail text below the title.",
      },
      duration: {
        type: "number",
        required: false,
        defaultValue: "5000",
        description: "Auto-dismiss delay in ms. When action is set and duration is omitted, the toast persists indefinitely per WCAG 2.2.1.",
      },
      action: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Action element (e.g. a Button) rendered on the right.",
      },
      id: {
        type: "string",
        required: false,
        defaultValue: "auto-generated",
        description: "Stable id for updating an existing toast (used by toast.promise to swap loading -> success/error).",
      },
    },
  },
}
