import type { ComponentDoc } from "./types";

export const fieldDoc: ComponentDoc = {
  description:
    "Form field primitives that wire labels, controls, descriptions, and validation messages without owning the actual input component.",
  notes: [
    {
      title: "Form Contract",
      content:
        "Field.Control clones one control element and applies id, required, disabled, aria-invalid, and aria-describedby from Field.Root. Use it with Input, Textarea, Select, or another control that accepts those props.",
    },
    {
      title: "InputGroup vs Field",
      content:
        "InputGroup is only a decorated input shell for prefix and suffix content. Plain text affixes are aria-hidden decoration; interactive affixes need explicit labels. Field is the form wrapper for label, helper text, and error wiring.",
    },
  ],
  usage: { example: "field-input" },
  examples: [{ name: "field-input", title: "Input" }],
  keyboard: null,
  props: {
    Field: {
      controlId: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "Override the auto-generated id used by the wrapped control, label, description, and error.",
      },
      invalid: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          "Marks the control as invalid; sets aria-invalid and surfaces Field.Error in aria-describedby.",
      },
      required: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description:
          "Marks the control as required and shows a required indicator next to Field.Label.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Disables the control and applies data-disabled to the field root.",
      },
    },
    "Field.Label": {
      htmlFor: {
        type: "string",
        required: false,
        defaultValue: "controlId",
        description: "Override the htmlFor target. Defaults to the Field's resolved control id.",
      },
      id: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "Override the auto-generated label id used for aria-labelledby on the control.",
      },
    },
    "Field.Control": {
      children: {
        type: "ReactElement",
        required: true,
        defaultValue: null,
        description:
          "Single child control. Field clones it with id, disabled, required, aria-invalid, aria-describedby, and aria-labelledby.",
      },
    },
    "Field.Description": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Helper text. Returns null when empty so aria-describedby stays clean.",
      },
    },
    "Field.Error": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Validation message. Surfaced in aria-describedby only while Field is invalid.",
      },
    },
  },
};
