"use client";

import { createContext, useContext } from "react";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";

export type ToggleGroupSelectionMode = "single" | "multiple";

export interface ToggleGroupContextValue {
  /** Returns whether the given item value is selected. */
  isItemSelected: (value: string) => boolean;
  /** Fired when the selected value(s) change. */
  onChange: (value: string) => void;
  /** Fired when the highlighted value changes. */
  onHighlightChange: (value: string | null) => void;
  /** Disables the entire group. */
  disabled: boolean;
  /** Item size token. */
  size: SegmentedSize;
  /** Visual style variant. */
  variant: SegmentedVariant;
  highlightedValue: string | null;
  usesButtonSemantics: boolean;
  tabTargetValue: string | null;
  registerItem: (
    itemId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters item from toggle group. */
  unregisterItem: (itemId: string) => void;
}

export const ToggleGroupContext = createContext<ToggleGroupContextValue | undefined>(undefined);

export function useToggleGroupContext() {
  const context = useContext(ToggleGroupContext);
  if (!context) {
    throw new Error("ToggleGroup.Item must be used within ToggleGroup");
  }
  return context;
}
