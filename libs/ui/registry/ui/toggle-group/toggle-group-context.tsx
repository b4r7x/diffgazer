"use client";

import { createContext, type RefObject, useContext } from "react";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";

export type ToggleGroupSelectionMode = "single" | "multiple";

/** Context value shared by toggle group. */
export interface ToggleGroupContextValue {
  /**
   * Switches between radio-style single selection and pressed-button-style multiple selection.
   * Switches value/onChange/defaultValue from string|null to readonly string[].
   */
  selectionMode: ToggleGroupSelectionMode;
  /** Whether toggle group is item selected. */
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
  /** Ref for the container element. */
  containerRef: RefObject<HTMLDivElement | null>;
  usesButtonSemantics: boolean;
  tabTargetValue: string | null;
  /** Registers item with toggle group. */
  registerItem: (
    itemId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters item from toggle group. */
  unregisterItem: (itemId: string) => void;
}

/** React context backing toggle group. */
export const ToggleGroupContext = createContext<ToggleGroupContextValue | undefined>(undefined);

/** Reads the toggle group context. */
export function useToggleGroupContext() {
  const context = useContext(ToggleGroupContext);
  if (!context) {
    throw new Error("ToggleGroup.Item must be used within ToggleGroup");
  }
  return context;
}
