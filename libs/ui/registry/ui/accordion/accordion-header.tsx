"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AccordionHeaderContext } from "./accordion-context";

/** Props for accordion header. */
export interface AccordionHeaderProps {
  /** Heading level wrapping the trigger. */
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
  /** Typically an Accordion.Trigger. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/**
 * Optional explicit heading wrapper for trigger (h3 by default, configurable via as prop). Omit
 * it and AccordionTrigger supplies its own default heading.
 */
export function AccordionHeader({ as: Tag = "h3", children, className }: AccordionHeaderProps) {
  return (
    <AccordionHeaderContext value={true}>
      <Tag className={cn("m-0 font-normal", className)}>{children}</Tag>
    </AccordionHeaderContext>
  );
}
