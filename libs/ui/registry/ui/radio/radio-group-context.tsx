"use client";

import { createContext, useContext } from "react";
import type { SelectableVariant } from "@/lib/selectable-variants";
import type { RadioSize } from "./radio";

/** Context value shared by radio group. */
export interface RadioGroupContextValue {
  /** Controlled selected value. */
  value?: string;
  /** Called when the selected value changes. */
  onChange: (value: string) => void;
  /** Registers item with radio group. */
  registerItem: (
    itemId: string,
    itemValue: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters item from radio group. */
  unregisterItem: (itemId: string) => void;
  /** Disables the custom control and hidden input. */
  disabled: boolean;
  /** Enable built-in arrow-key navigation. */
  keyboardNavigation: boolean;
  /** Selectable control size token. */
  size: RadioSize;
  /** Indicator style. */
  variant: SelectableVariant;
  highlightedValue: string | null;
  /** Shared hidden native input name for grouped form submission. */
  name?: string;
  /** Requires one enabled item to be selected. */
  required?: boolean;
  /** Called when required invalid occurs. */
  onRequiredInvalid: () => void;
  tabTargetValue: string | null;
}

/** React context backing radio group. */
export const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

/** Reads the radio group context. */
export function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("RadioGroupItem must be used within RadioGroup");
  }
  return context;
}
