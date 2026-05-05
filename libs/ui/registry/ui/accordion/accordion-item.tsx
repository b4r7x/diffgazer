"use client";

import { useId, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAccordionContext, AccordionItemContext } from "./accordion-context";

export interface AccordionItemProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export function AccordionItem({ value, disabled = false, children, className }: AccordionItemProps) {
  const { value: openValues } = useAccordionContext();
  const isOpen = openValues.includes(value);
  const itemId = useId();
  const triggerId = `${itemId}-trigger`;
  const contentId = `${itemId}-content`;

  const contextValue = useMemo(() => ({ value, isOpen, disabled, triggerId, contentId }), [value, isOpen, disabled, triggerId, contentId]);

  return (
    <AccordionItemContext value={contextValue}>
      <div className={cn("py-2", className)} data-state={isOpen ? "open" : "closed"} data-disabled={disabled || undefined}>
        {children}
      </div>
    </AccordionItemContext>
  );
}
