"use client";

import { createContext, useContext } from "react";
import type { SelectableVariant } from "@/lib/selectable-variants";
import type { CheckboxSize } from "./checkbox";

export type CheckboxGroupContextValue = {
  value: string[];
  toggle: (itemValue: string) => void;
  registerItem: (
    itemId: string,
    itemValue: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  unregisterItem: (itemId: string) => void;
  disabled: boolean;
  size: CheckboxSize;
  variant: SelectableVariant;
  strikethrough: boolean;
  highlightedValue: string | null;
  name?: string;
};

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue | undefined>(undefined);

export function useCheckboxGroupContext() {
  const context = useContext(CheckboxGroupContext);
  if (!context) throw new Error("CheckboxItem must be used within CheckboxGroup");
  return context;
}
