"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAccordionItemContext } from "./accordion-context";

export interface AccordionContentProps {
  children: ReactNode;
  className?: string;
  region?: boolean;
}

export function AccordionContent({ children, className, region = false }: AccordionContentProps) {
  const { isOpen, triggerId, contentId } = useAccordionItemContext();
  const exposesRegion = region && isOpen;

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
      aria-hidden={!isOpen || undefined}
      inert={!isOpen || undefined}
    >
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "region" (Biome cannot resolve the ternary); aria-labelledby is applied only in the same branch and is valid for the region role. */}
      <div
        className={cn("overflow-hidden min-h-0 pt-2", className)}
        role={exposesRegion ? "region" : undefined}
        id={contentId}
        aria-labelledby={exposesRegion ? triggerId : undefined}
      >
        {children}
      </div>
    </div>
  );
}
