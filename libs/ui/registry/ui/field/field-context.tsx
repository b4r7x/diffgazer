"use client";

import { createContext, type ReactNode, type RefObject, useContext } from "react";

export type FieldSlot = "label" | "description" | "error";

export interface FieldSlotRegistration {
  id: string;
  hasContent: boolean;
}

export interface FieldContextValue {
  controlId: string;
  defaultLabelId: string;
  defaultDescriptionId: string;
  defaultErrorId: string;
  invalid: boolean;
  required: boolean | undefined;
  disabled: boolean | undefined;
  controlRef: RefObject<HTMLElement | null>;
  labelId: string | undefined;
  describedBy: string | undefined;
  registerControlId: (id: string | null) => void;
  registerSlot: (slot: FieldSlot, registration: FieldSlotRegistration) => void;
  unregisterSlot: (slot: FieldSlot) => void;
}

export const FieldContext = createContext<FieldContextValue | undefined>(undefined);

export function useFieldContext(source: string) {
  const context = useContext(FieldContext);
  if (!context) throw new Error(`${source} must be used within Field`);
  return context;
}

export function hasRenderableContent(children: ReactNode): boolean {
  if (children === null || children === undefined || typeof children === "boolean") return false;
  if (typeof children === "string") return children.length > 0;
  if (typeof children === "number") return true;
  if (Array.isArray(children)) return children.some(hasRenderableContent);
  return true;
}

const LABELABLE_TAGS = new Set([
  "BUTTON",
  "INPUT",
  "METER",
  "OUTPUT",
  "PROGRESS",
  "SELECT",
  "TEXTAREA",
]);

export function isLabelableElement(element: HTMLElement | null): boolean {
  return element !== null && LABELABLE_TAGS.has(element.tagName);
}

export function isDisabledControl(element: HTMLElement, fieldDisabled: boolean | undefined) {
  return (
    fieldDisabled === true ||
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}
