"use client";

import { createContext, useContext, type RefObject } from "react";
import type { RadioSize } from "./radio";
import type { SelectableVariant } from "@/lib/selectable-variants";

export interface RadioGroupContextValue {
  value?: string;
  onChange: (value: string) => void;
  onHighlightChange: (value: string) => void;
  disabled: boolean;
  size: RadioSize;
  variant: SelectableVariant;
  highlightedValue: string | null;
  name?: string;
  required?: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

export function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("RadioGroupItem must be used within RadioGroup");
  }
  return context;
}
