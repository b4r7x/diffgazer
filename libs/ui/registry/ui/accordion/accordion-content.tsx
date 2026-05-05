"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAccordionItemContext } from "./accordion-context";

export interface AccordionContentProps {
  children: ReactNode;
  className?: string;
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const { isOpen, triggerId, contentId } = useAccordionItemContext();

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
      aria-hidden={!isOpen || undefined}
      inert={!isOpen || undefined}
    >
      <div
        className={cn("overflow-hidden min-h-0 pt-2", className)}
        role="region"
        id={contentId}
        aria-labelledby={triggerId}
      >
        {children}
      </div>
    </div>
  );
}
