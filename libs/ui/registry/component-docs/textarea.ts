import type { ComponentDoc } from "./types.js";

export const textareaDoc: ComponentDoc = {
  description:
    "Terminal-styled multi-line text area with size variants, resize handles that sit outside the scroll area, and a scrollbar that keeps the final line reachable.",
  notes: [
    {
      title: "Resize Direction",
      content:
        'Set resize to "vertical", "horizontal", "both", or "none". The default vertical mode puts a handle on the bottom edge, horizontal puts one on the right edge, and both exposes each edge independently and leaves the corner between them empty. Every handle is a button: drag it, or focus it and press ArrowDown/ArrowUp (vertical) or ArrowRight/ArrowLeft (horizontal) to step by 8px, or press Enter or Space to grow by the same step. Each resizable edge reserves a 16px band outside the field, so the scrollbar stays inside the textarea and can reach the final line.',
    },
    {
      title: "Resize Handle Style",
      content:
        'Pass resizeHandle to choose how each handle is drawn. "line" is a 30px mark centered on the edge and held 10px clear of the field border, so it paints nothing over the field. "box" is a 20px chip carrying only the direction arrow, centered on the field border: the border runs unbroken behind it and half the chip overlaps the field at the edge midpoint. "box-label" is the same chip widened to carry a RESIZE label beside the arrow. Give one value to style both edges, or an object with vertical and horizontal keys to style them independently. The drawing is decorative; the handle button keeps its accessible label and keyboard behavior either way.',
    },
    {
      title: "Read-only vs Disabled",
      content:
        "Textarea styles the two states on different channels so they cannot be confused. Disabled keeps a faint surface, dashed edge, and muted ink: the field is not part of this form. Read-only uses a subtle recessed surface plus an inset start rail while preserving full-contrast ink: the value matters, it just cannot be edited. A read-only field stays focusable and copyable, and the focus ring still applies on top. Both states suppress every resize handle.",
    },

    {
      title: "Invalid State",
      content:
        "Set aria-invalid=true to apply the error border. The error ring joins on focus, so focus stays the strongest edge a field shows. Field.Control sets aria-invalid automatically when Field.invalid is true.",
    },
  ],
  usage: { example: "textarea-default" },
  examples: [
    { name: "textarea-default", title: "Default" },
    { name: "textarea-resize-directions", title: "Resize directions" },
    { name: "textarea-variants", title: "Variants" },
    { name: "textarea-focus", title: "Focus" },
  ],
  keyboard: null,
  props: {
    Textarea: {
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description:
          "Padding, font-size, and min-height token. Resize behavior is configured independently.",
      },
      resize: {
        type: '"none" | "vertical" | "horizontal" | "both"',
        required: false,
        defaultValue: '"vertical"',
        description:
          "Axes/edges that expose a resize handle. Read-only and disabled textareas suppress every handle.",
      },
      resizeHandle: {
        type: "TextareaResizeHandle | { vertical?: TextareaResizeHandle; horizontal?: TextareaResizeHandle }",
        required: false,
        defaultValue: '"line"',
        description:
          'How each resize handle is drawn: "line" for a 30px mark held off the field border, "box" for an arrow-only chip centered on the border, or "box-label" for that chip with a RESIZE label. A single value styles both edges; an object styles each edge independently.',
      },
      resizeLabels: {
        type: "{ vertical?: string; horizontal?: string }",
        required: false,
        defaultValue: '"Resize textarea vertically" / "Resize textarea horizontally"',
        description: "Accessible names for the resize handles, per axis.",
      },
      "aria-invalid": {
        type: 'boolean | "true" | "false" | "grammar" | "spelling"',
        required: false,
        defaultValue: null,
        description:
          'The native ARIA invalid state. The error border applies to true/"true"; the error ring joins on focus. Field.Control sets this automatically when Field.invalid is true.',
      },
    },
  },
};
