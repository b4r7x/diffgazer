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
}
