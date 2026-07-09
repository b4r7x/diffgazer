"use client";

import { type AriaAttributes, createContext, type RefObject, useContext } from "react";

/** Metadata stored for select option. */
export interface SelectOptionMetadata {
  /** Accessible label text. */
  label: string;
  /** Disable the trigger and prevent open. */
  disabled: boolean;
}

/** Context value shared by select. */
export interface SelectContextValue {
  /** Controlled open state. Pair with onOpenChange. */
  open: boolean;
  /** Disable the trigger and prevent open. */
  disabled: boolean;
  searchable: boolean;
  /** Called when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Controlled selected value. string[] when multiple, string in single mode. */
  value: string | null | string[];
  /** Enable multi-select. value/onChange become string[]. */
  multiple: boolean;
  searchQuery: string;
  /** Called when search change occurs. */
  onSearchChange: (query: string) => void;
  /** Controlled highlighted item id. Pair with onHighlightChange. */
  highlighted: string | null;
  /** Updates highlighted. */
  setHighlighted: (value: string | null) => void;
  selectItem: (value: string) => void;
  /** Registers option with select. */
  registerOption: (value: string, metadata: SelectOptionMetadata) => void;
  /** Unregisters option from select. */
  unregisterOption: (value: string) => void;
  options: ReadonlyMap<string, SelectOptionMetadata>;
  /** Ref for the trigger element. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Ref for the content element. */
  contentRef: RefObject<HTMLDivElement | null>;
  /** Ref for the search input element. */
  searchInputRef: RefObject<HTMLInputElement | null>;
  /**
   * Visual treatment. "card" renders the inline settings-panel layout (combine with
   * defaultOpen).
   */
  variant: "default" | "card";
  /** DOM id for listbox. */
  listboxId: string;
  /** DOM id for trigger. */
  triggerId: string;
  ariaInvalid: AriaAttributes["aria-invalid"] | undefined;
  ariaDescribedBy: string | undefined;
  ariaLabelledBy: string | undefined;
  /** Mark the select as required for native form validation. */
  required: boolean | undefined;
  /** Called when native invalid occurs. */
  onNativeInvalid: () => void;
}

/** React context backing select. */
export const SelectContext = createContext<SelectContextValue | undefined>(undefined);

/** Reads the select context. */
export function useSelectContext(source?: string): SelectContextValue {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error(`${source ?? "Select compound components"} must be used within a Select`);
  }
  return context;
}
