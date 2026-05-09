"use client";

import { createContext, useContext } from "react";
import type { RadioSize } from "./radio";
import type { SelectableVariant } from "@/lib/selectable-variants";

export interface RadioGroupContextValue {
  value?: string;
  onChange: (value: string) => void;
  registerItem: (itemId: string, itemValue: string, disabled: boolean, element: HTMLElement | null) => void;
  unregisterItem: (itemId: string) => void;
  disabled: boolean;
  keyboardNavigation: boolean;
  size: RadioSize;
  variant: SelectableVariant;
  highlightedValue: string | null;
  name?: string;
  required?: boolean;
  onRequiredInvalid: () => void;
  tabTargetValue: string | null;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

export function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("RadioGroupItem must be used within RadioGroup");
  }
  return context;
}
