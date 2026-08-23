"use client";

import { createContext, useContext } from "react";

export interface AccordionContextValue {
  /**
   * Normalized open values; single mode contains zero or one item, while multiple mode may contain
   * several.
   */
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

export function useAccordionHeaderPresent() {
  return useContext(AccordionHeaderContext);
}

export const AccordionContext = createContext<AccordionContextValue | undefined>(undefined);

export function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion compound components must be used within Accordion");
  }
  return context;
}

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

export const AccordionItemContext = createContext<AccordionItemContextValue | undefined>(undefined);

export function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error("AccordionTrigger/AccordionContent must be used within AccordionItem");
  }
  return context;
}
