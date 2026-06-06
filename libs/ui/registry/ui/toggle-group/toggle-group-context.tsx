"use client";

import { createContext, type RefObject, useContext } from "react";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";

export type ToggleGroupSelectionMode = "single" | "multiple";

export interface ToggleGroupContextValue {
  selectionMode: ToggleGroupSelectionMode;
  isItemSelected: (value: string) => boolean;
  onChange: (value: string) => void;
  onHighlightChange: (value: string | null) => void;
  disabled: boolean;
  size: SegmentedSize;
  variant: SegmentedVariant;
  highlightedValue: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  usesButtonSemantics: boolean;
  tabTargetValue: string | null;
  registerItem: (itemId: string, value: string, disabled: boolean, element: HTMLElement | null) => void;
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
