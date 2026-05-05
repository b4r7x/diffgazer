import type { ComponentDoc } from "./types"

export const dialogDoc: ComponentDoc = {
  description: "Modal dialog with compound component architecture. Uses box-drawing title decoration, side borders, and native dialog element.",
  anatomy: [
    { name: "Dialog", indent: 0, note: "Root (manages open state)" },
    { name: "DialogTrigger", indent: 1, note: "Opens the dialog" },
    { name: "DialogContent", indent: 1, note: "Modal container (native dialog)" },
    { name: "DialogHeader", indent: 2, note: "Header wrapper" },
    { name: "DialogTitle", indent: 3, note: "Accessible title" },
    { name: "DialogDescription", indent: 3, note: "Accessible description" },
    { name: "DialogBody", indent: 2, note: "Scrollable content" },
    { name: "DialogFooter", indent: 2, note: "Action buttons" },
    { name: "DialogClose", indent: 3, note: "Close button" },
    { name: "DialogAction", indent: 3, note: "Primary action button (closes unless prevented)" },
    { name: "DialogKeyboardHints", indent: 2, note: "Keyboard shortcut hints" },
  ],
  notes: [
    {
      title: "Compound Architecture",
      content:
        "Dialog is composed of 11 parts: Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose, DialogAction, and DialogKeyboardHints.",
    },
    {
      title: "Native Dialog",
      content:
        "DialogContent uses the native <dialog> element with showModal(), which provides built-in focus management, inert background, top-layer rendering, and accessible modal semantics. Focus is restored to the trigger on close.",
    },
    {
      title: "Alert Dialog",
      content:
        'Set role="alertdialog" and closeOnBackdropClick={false} on DialogContent for destructive confirmations. Screen readers announce it as an alert requiring immediate attention. Per WAI-ARIA APG, alert dialogs should not close on outside interaction, and focus should start on the safest action (e.g., Cancel) using autoFocus.',
    },
    {
      title: "Escape Interception",
      content:
        "Pass onEscapeKeyDown to DialogContent to intercept the Escape key. Call e.preventDefault() to keep the dialog open — useful during async operations or form validation.",
    },
    {
      title: "Preventing Close on Action",
      content:
        "DialogAction and DialogClose check e.defaultPrevented. Call e.preventDefault() in your onClick handler to keep the dialog open — useful for async validation where you want to close only on success.",
    },
    {
      title: "DialogKeyboardHints",
      content:
        "A sub-component that renders keyboard shortcut hints below the dialog. Accepts custom hints via the hints prop. Returns null for an empty hints array.",
    },
  ],
  usage: { example: "dialog-default" },
  examples: [
    { name: "dialog-default", title: "Default" },
    { name: "dialog-description", title: "With Description" },
    { name: "dialog-alert", title: "Alert Dialog" },
    { name: "dialog-form", title: "With Form" },
    { name: "dialog-sizes", title: "Sizes" },
    { name: "dialog-upload", title: "Upload" },
    { name: "dialog-keyboard", title: "Keyboard" },
    { name: "dialog-custom-trigger", title: "Custom Trigger" },
  ],
  keyboard: {
    description:
      "Dialog uses the native <dialog> element for modal behavior. Escape closes the dialog and focus is automatically restored to the trigger. Tab cycles focus between focusable elements within the dialog (native inert background). Enter activates the focused button (DialogAction or DialogClose).",
    examples: [
      { name: "dialog-default", title: "Default with keyboard" },
      { name: "dialog-keyboard", title: "Keyboard hints" },
    ],
  },
}
