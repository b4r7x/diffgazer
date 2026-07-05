"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import {
  useAccordionContext,
  useAccordionHeaderPresent,
  useAccordionItemContext,
} from "./accordion-context";

/** Class variants for trigger. */
export const accordionTriggerVariants = cva(
  "flex w-full items-center gap-2 font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default: "text-sm",
        source: "text-xs mb-2",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed hover:text-muted-foreground",
        false: "",
      },
    },
    defaultVariants: { variant: "default", disabled: false },
  },
);

/** Props for accordion trigger variant. */
export type AccordionTriggerVariantProps = VariantProps<typeof accordionTriggerVariants>;

/** Props for accordion trigger. */
export interface AccordionTriggerProps
  extends Omit<ComponentPropsWithRef<"button">, "children">,
    Omit<VariantProps<typeof accordionTriggerVariants>, "disabled"> {
  /** Trigger label. */
  children: ReactNode;
  /** Custom handle element. Pass null to hide the chevron entirely. */
  handle?: ReactNode | null;
  /**
   * Heading level wrapping the trigger button (APG heading requirement). Ignored when the
   * trigger is already composed inside an AccordionHeader.
   */
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6";
}

/**
 * Clickable button that toggles content. Wraps itself in a default h3 heading unless composed
 * inside AccordionHeader.
 */
export function AccordionTrigger({
  children,
  className,
  variant,
  handle,
  headingLevel: Heading = "h3",
  disabled: triggerDisabled,
  ref,
  onClick,
  ...props
}: AccordionTriggerProps) {
  const { onToggle, collapsible } = useAccordionContext();
  const { value, isOpen, disabled, triggerId, contentId } = useAccordionItemContext();
  const headerPresent = useAccordionHeaderPresent();

  const isAriaDisabled = !collapsible && isOpen;
  const isDisabled = disabled || !!triggerDisabled;
  const resolvedHandle = handle === undefined ? <Chevron open={isOpen} size="sm" /> : handle;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (isDisabled || isAriaDisabled) {
      event.preventDefault();
      return;
    }

    onToggle(value);
  };

  const trigger = (
    <button
      {...props}
      ref={ref}
      type="button"
      id={triggerId}
      data-slot="accordion-trigger"
      data-state={isOpen ? "open" : "closed"}
      data-value={value}
      data-diffgazer-navigation-item="button"
      data-disabled={isDisabled ? "" : undefined}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isAriaDisabled || disabled || undefined}
      aria-expanded={isOpen}
      aria-controls={contentId}
      className={cn(
        accordionTriggerVariants({ variant, disabled: isDisabled || isAriaDisabled }),
        className,
      )}
    >
      {resolvedHandle}
      {children}
    </button>
  );

  if (headerPresent) return trigger;

  return <Heading className="m-0 font-normal">{trigger}</Heading>;
}
