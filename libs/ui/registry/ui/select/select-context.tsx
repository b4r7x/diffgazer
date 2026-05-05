"use client";

import { createContext, useContext, type RefObject } from "react";

export interface SelectContextValue {
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | string[];
  multiple: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  highlighted: string | null;
  onHighlight: (value: string | null) => void;
  selectItem: (value: string) => void;
  labelsRef: RefObject<Map<string, string>>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  variant: "default" | "card";
  listboxId: string;
  triggerId: string;
  ariaInvalid: boolean | undefined;
}

export const SelectContext = createContext<SelectContextValue | undefined>(
  undefined
);

export function useSelectContext(source?: string): SelectContextValue {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error(
      `${source ?? "Select compound components"} must be used within a Select`
    );
  }
  return context;
}
