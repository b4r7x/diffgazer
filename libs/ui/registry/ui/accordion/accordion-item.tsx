"use client";

import { type ReactNode, useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import { AccordionItemContext, useAccordionContext } from "./accordion-context";

/** Props for accordion item. */
export interface AccordionItemProps {
  /** Stable identifier matched against the Accordion value. */
  value: string;
  /** Disables the item: trigger is not focusable and not toggleable. */
  disabled?: boolean;
  /** Header and Content children. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Wrapper for each collapsible section. */
export function AccordionItem({
  value,
  disabled = false,
  children,
  className,
}: AccordionItemProps) {
  const { value: openValues } = useAccordionContext();
  const isOpen = openValues.includes(value);
  const itemId = useId();
  const triggerId = `${itemId}-trigger`;
  const contentId = `${itemId}-content`;

  const contextValue = useMemo(
    () => ({ value, isOpen, disabled, triggerId, contentId }),
    [value, isOpen, disabled, triggerId, contentId],
  );

  return (
    <AccordionItemContext value={contextValue}>
      <div
        className={cn("py-2", className)}
        data-slot="accordion-item"
        data-state={isOpen ? "open" : "closed"}
        data-disabled={disabled || undefined}
      >
        {children}
      </div>
    </AccordionItemContext>
  );
}
