"use client";

import { createContext, useContext } from "react";

/** Context value shared by accordion. */
export interface AccordionContextValue {
  /** Controlled open value(s). string for single mode, string[] for multiple. */
  value: string[];
  /** Called when an item should toggle. */
  onToggle: (itemValue: string) => void;
  /** Single mode only. When false, the currently open item cannot be closed by clicking it. */
  collapsible: boolean;
}

/**
 * Set by AccordionHeader so a trigger composed inside it skips its own default
 * heading wrapper, avoiding a doubled heading in the accessibility tree.
 */
export const AccordionHeaderContext = createContext(false);

/** Provides accordion header present behavior. */
export function useAccordionHeaderPresent() {
  return useContext(AccordionHeaderContext);
}

/** React context backing accordion. */
export const AccordionContext = createContext<AccordionContextValue | undefined>(undefined);

/** Reads the accordion context. */
export function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion compound components must be used within Accordion");
  }
  return context;
}

/** Context value shared by accordion item. */
export interface AccordionItemContextValue {
  /** Stable identifier matched against the Accordion value. */
  value: string;
  /** Whether accordion item is open. */
  isOpen: boolean;
  /** Disables the item: trigger is not focusable and not toggleable. */
  disabled: boolean;
  /** DOM id for trigger. */
  triggerId: string;
  /** DOM id for content. */
  contentId: string;
}

/** React context backing accordion item. */
export const AccordionItemContext = createContext<AccordionItemContextValue | undefined>(undefined);

/** Reads the accordion item context. */
export function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error("AccordionTrigger/AccordionContent must be used within AccordionItem");
  }
  return context;
}
