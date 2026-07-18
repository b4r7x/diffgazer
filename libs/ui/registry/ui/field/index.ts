"use client";

import { FieldControl, type FieldControlProps } from "./field-control";
import { FieldDescription, type FieldDescriptionProps } from "./field-description";
import { FieldError, type FieldErrorProps } from "./field-error";
import { FieldLabel, type FieldLabelProps } from "./field-label";
import { Field as FieldPrimitive, type FieldProps } from "./field";

const Field = Object.assign(FieldPrimitive, {
  Label: FieldLabel,
  Control: FieldControl,
  Description: FieldDescription,
  Error: FieldError,
});

export { Field, FieldControl, FieldDescription, FieldError, FieldLabel };

export type {
  FieldControlProps,
  FieldDescriptionProps,
  FieldErrorProps,
  FieldLabelProps,
  FieldProps,
};
