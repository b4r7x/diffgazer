"use client";

import { createContext, useContext } from "react";
import type { SelectableVariant } from "@/lib/selectable-variants";
import type { CheckboxSize } from "./checkbox";

/** Context value shared by checkbox group. */
export type CheckboxGroupContextValue = {
  /** Controlled selected item values. */
  value: string[];
  /** Toggles the checkbox group item. */
  toggle: (itemValue: string) => void;
  /** Registers item with checkbox group. */
  registerItem: (
    itemId: string,
    itemValue: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters item from checkbox group. */
  unregisterItem: (itemId: string) => void;
  /** Disables the group and all items. */
  disabled: boolean;
  /** Selectable control size token. */
  size: CheckboxSize;
  /** Indicator style. */
  variant: SelectableVariant;
  /** Applies muted line-through styling to the label when checked. */
  strikethrough: boolean;
  highlightedValue: string | null;
  /** Shared hidden native input name for grouped form submission. */
  name?: string;
};

/** React context backing checkbox group. */
export const CheckboxGroupContext = createContext<CheckboxGroupContextValue | undefined>(undefined);

/** Reads the checkbox group context. */
export function useCheckboxGroupContext() {
  const context = useContext(CheckboxGroupContext);
  if (!context) throw new Error("CheckboxItem must be used within CheckboxGroup");
  return context;
}
