"use client";

import { createContext, useContext, type RefObject } from "react";

export interface ToggleGroupContextValue {
  value: string | null;
  onChange: (value: string) => void;
  onHighlightChange: (value: string | null) => void;
  disabled: boolean;
  size: "sm" | "md";
  highlightedValue: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  allowDeselect: boolean;
  firstEnabledValue: string | null;
  registerItem: (value: string, disabled: boolean) => () => void;
}

export const ToggleGroupContext = createContext<ToggleGroupContextValue | undefined>(undefined);

export function useToggleGroupContext() {
  const context = useContext(ToggleGroupContext);
  if (!context) {
    throw new Error("ToggleGroup.Item must be used within ToggleGroup");
  }
  return context;
}
