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
    { name: "DialogFooter", indent: 2, note: "Action buttons and optional keyboard hints" },
    { name: "DialogFooter.Hints", indent: 3, note: "Inline keyboard shortcut hints" },
    { name: "DialogFooter.Actions", indent: 3, note: "Action button row" },
    { name: "DialogClose", indent: 3, note: "Close button" },
    { name: "DialogAction", indent: 3, note: "Primary action button (closes unless prevented)" },
  ],
  notes: [
    {
      title: "Compound Architecture",
      content:
        "Dialog is composed of 10 parts: Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter (with DialogFooter.Hints and DialogFooter.Actions sub-components), DialogClose, and DialogAction.",
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
      title: "Keyboard hints",
      content:
        "Pass a hints array to DialogFooter (or compose DialogFooter.Hints) to render inline keyboard shortcut hints alongside the action buttons. Hints render inside the footer, matching the global footer's Kbd primitive and typography.",
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
  props: {
    Dialog: {
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
        description: "Initial open state for uncontrolled usage.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description: "Called whenever open state changes (trigger click, Escape, backdrop click, programmatic close).",
      },
    },
    DialogContent: {
      size: {
        type: '"sm" | "md" | "lg" | "full"',
        required: false,
        defaultValue: '"md"',
        description: "Modal width preset.",
      },
      role: {
        type: '"dialog" | "alertdialog"',
        required: false,
        defaultValue: '"dialog"',
        description: "Set role=\"alertdialog\" for destructive confirmations. Per WAI-ARIA APG, alert dialogs should not close on outside interaction.",
      },
      closeOnBackdropClick: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "When false, clicking the backdrop does not close the dialog (recommended for alertdialog).",
      },
      onEscapeKeyDown: {
        type: "(e: SyntheticEvent<HTMLDialogElement>) => void",
        required: false,
        defaultValue: null,
        description: "Intercept Escape. Call e.preventDefault() to keep the dialog open during async operations.",
      },
      onCancel: {
        type: "(e: SyntheticEvent<HTMLDialogElement>) => void",
        required: false,
        defaultValue: null,
        description: "Native cancel handler. Defaults to closing the dialog.",
      },
    },
    DialogTrigger: {
      children: {
        type: "ReactNode | (renderProps: DialogTriggerRenderProps) => ReactNode",
        required: true,
        defaultValue: null,
        description: "Trigger button or render function. The render form receives ref, className, aria-haspopup/expanded/controls, and onClick.",
      },
    },
    DialogAction: {
      onClick: {
        type: "(e: MouseEvent<HTMLButtonElement>) => void",
        required: false,
        defaultValue: null,
        description: "Primary action handler. Call e.preventDefault() to keep the dialog open (e.g. failed form validation).",
      },
    },
    DialogClose: {
      onClick: {
        type: "(e: MouseEvent<HTMLButtonElement>) => void",
        required: false,
        defaultValue: null,
        description: "Close handler. Call e.preventDefault() to keep the dialog open.",
      },
    },
    DialogFooter: {
      hints: {
        type: "KeyboardHint[]",
        required: false,
        defaultValue: null,
        description: "Inline keyboard shortcut hints rendered alongside the action buttons. Use the shorthand instead of composing DialogFooter.Hints when the hints belong with the footer actions.",
      },
    },
  },
}
