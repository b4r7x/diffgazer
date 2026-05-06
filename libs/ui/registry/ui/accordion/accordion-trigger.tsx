"use client";

import { type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useAccordionContext, useAccordionItemContext } from "./accordion-context";

const triggerVariants = cva(
  "flex w-full items-center gap-2 font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
  {
    variants: {
      variant: {
        default: "text-sm",
        source: "text-xs mb-2",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface AccordionTriggerProps extends VariantProps<typeof triggerVariants> {
  children: ReactNode;
  className?: string;
  /** Custom handle element. Defaults to an animated Chevron. Pass `null` to hide. */
  handle?: ReactNode | null;
}

export function AccordionTrigger({ children, className, variant, handle }: AccordionTriggerProps) {
  const { onToggle, collapsible } = useAccordionContext();
  const { value, isOpen, disabled, triggerId, contentId } = useAccordionItemContext();

  const isDisabled = disabled || (!collapsible && isOpen);
  const resolvedHandle = handle === undefined ? <Chevron open={isOpen} size="sm" /> : handle;

  return (
    <button
      type="button"
      id={triggerId}
      data-value={value}
      data-navigation-role="button"
      onClick={() => onToggle(value)}
      disabled={isDisabled}
      aria-expanded={isOpen}
      aria-controls={contentId}
      className={cn(triggerVariants({ variant }), className)}
    >
      {resolvedHandle}
      {children}
    </button>
  );
}
