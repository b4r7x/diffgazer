"use client";

import { type AriaAttributes, createContext, type RefObject, useContext } from "react";

export interface SelectOptionMetadata {
  label: string;
  disabled: boolean;
}

export interface SelectContextValue {
  open: boolean;
  disabled: boolean;
  searchable: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null | string[];
  multiple: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  highlighted: string | null;
  setHighlighted: (value: string | null) => void;
  selectItem: (value: string) => void;
  options: ReadonlyMap<string, SelectOptionMetadata>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  variant: "default" | "card";
  listboxId: string;
  triggerId: string;
  ariaInvalid: AriaAttributes["aria-invalid"] | undefined;
  ariaDescribedBy: string | undefined;
  ariaLabelledBy: string | undefined;
  required: boolean | undefined;
  onNativeInvalid: () => void;
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
