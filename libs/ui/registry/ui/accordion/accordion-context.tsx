"use client";

import { createContext, useContext } from "react";

export interface AccordionContextValue {
  value: string[];
  onToggle: (itemValue: string) => void;
  collapsible: boolean;
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
  value: string;
  isOpen: boolean;
  disabled: boolean;
  triggerId: string;
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
