import type { ComponentDoc } from "./types";

export const fieldDoc: ComponentDoc = {
  description:
    "Form field primitives that wire labels, controls, descriptions, and validation messages without owning the actual input component.",
  notes: [
    {
      title: "Form Contract",
      content:
        "Field.Control clones one control element and applies id, required, disabled, aria-invalid, and aria-describedby from Field.Root. A disabled Field.Root remains authoritative even if the child explicitly sets disabled={false}. Use Field.Control with Input, Textarea, Select, or another control that accepts those props. A consumer id on the control child wins: Field keeps the child's own id and points Field.Label's htmlFor at it. Slots register through context, so wrapping Field.Label, Field.Description, or Field.Error in a layout element keeps the ARIA wiring intact.",
    },
    {
      title: "InputGroup vs Field",
      content:
        "InputGroup is only a decorated input shell for prefix and suffix content. Plain text affixes are aria-hidden decoration; interactive affixes need explicit labels. Field is the form wrapper for label, helper text, and error wiring.",
    },
  ],
  usage: { example: "field-input" },
  examples: [
    { name: "field-input", title: "Input" },
    { name: "field-form", title: "Form integration" },
  ],
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
        description:
          "Disables the control and applies data-disabled to the field root. This remains authoritative when the child sets disabled={false}.",
      },
    },
    "Field.Label": {
      htmlFor: {
        type: "string",
        required: false,
        defaultValue: "controlId",
        description:
          "Override the htmlFor target. Defaults to the Field's resolved control id (a consumer id on the control child wins). For div-based controls such as Checkbox and Radio, clicking the label also focuses and activates the control.",
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
          "Single child control. Field clones it with id, disabled, required, aria-invalid, aria-describedby, and aria-labelledby. If the child supplies its own id, that id wins and Field.Label's htmlFor follows it.",
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
          "Validation message. Renders and is surfaced in aria-describedby only while Field is invalid.",
      },
    },
  },
};
