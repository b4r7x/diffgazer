import type { ComponentDoc } from "./types"

export const dialogDoc: ComponentDoc = {
  description: "Modal dialog with compound component architecture. Built on the native dialog element with two orthogonal visual axes: frame (border or none) and corners (none, subtle, standard, bold, or outset), and an optional header marker bar spanning the title and description.",
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
    { name: "DialogCloseIcon", indent: 2, note: "Optional top-right close button — render LAST inside DialogContent so DOM/Tab order is correct (it absolute-positions itself)" },
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
    {
      title: "Extending DialogContent styles",
      content:
        "dialogContentVariants is the CVA used by DialogContent. Re-export it to compose custom variants for product-specific dialog shells — e.g. extend the base classes with bg/border tokens, or add new size keys. The frame and corners variants intentionally hold empty class strings; their visual styling is driven by [data-frame] / [data-corners] selectors in shared/dialog.css.",
    },
  ],
  usage: { example: "dialog-default" },
  examples: [
    { name: "dialog-default", title: "Default" },
    { name: "dialog-bracketed", title: "Bracketed" },
    { name: "dialog-viewfinder", title: "Viewfinder" },
    { name: "dialog-viewfinder-subtle", title: "Viewfinder Subtle" },
    { name: "dialog-viewfinder-bold", title: "Viewfinder Bold" },
    { name: "dialog-viewfinder-outset", title: "Viewfinder Outset" },
    { name: "dialog-description", title: "With Description" },
    { name: "dialog-alert", title: "Alert Dialog" },
    { name: "dialog-form", title: "With Form" },
    { name: "dialog-sizes", title: "Sizes" },
    { name: "dialog-upload", title: "Upload" },
    { name: "dialog-keyboard", title: "Keyboard" },
    { name: "dialog-custom-trigger", title: "Custom Trigger" },
    { name: "dialog-close-icon", title: "With Close Icon" },
    { name: "dialog-header-flat", title: "Header (flat marker)" },
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
      frame: {
        type: '"border" | "none"',
        required: false,
        defaultValue: '"border"',
        description: 'Border frame style. "border" renders a 1px border around the dialog. "none" removes the border (pair with corners for a frameless viewfinder look).',
      },
      corners: {
        type: '"none" | "subtle" | "standard" | "bold" | "outset"',
        required: false,
        defaultValue: '"none"',
        description: 'Corner accent marks drawn at the dialog corners. "none" skips them. "subtle" uses border color and tighter 12px arms. "standard" uses foreground color 18px arms. "bold" uses foreground color 28px arms. "outset" is standard shifted 3px outside the dialog edge. Combine with frame="none" for a pure viewfinder look or frame="border" for a bracketed-frame look.',
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
    DialogHeader: {
      marker: {
        type: '"bar" | "none"',
        required: false,
        defaultValue: '"bar"',
        description: "Header leading marker. \"bar\" (default) renders a 4px foreground accent bar with flex gap-3 outer spacing and a nested text column. \"none\" is the neutral form — no bar, no gap, children render as direct flex-col descendants — intended for headers with a background color, horizontal title-row layouts, or custom compositions. Consumer className overrides (padding, flex direction, background) merge cleanly on both variants via tailwind-merge.",
      },
    },
    DialogTitle: {
      as: {
        type: '"h1" | "h2" | "h3" | "h4" | "h5" | "h6"',
        required: false,
        defaultValue: '"h2"',
        description: "Heading level for the title element.",
      },
      meta: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Optional right-aligned eyebrow tag (e.g. \"CONFIRM\", \"DESTRUCTIVE\"). Decorative — rendered aria-hidden so it does not leak into the accessible name.",
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
    DialogCloseIcon: {
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: '"Close dialog"',
        description: "Accessible name for the close button. Override for localization or alternative phrasing.",
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
