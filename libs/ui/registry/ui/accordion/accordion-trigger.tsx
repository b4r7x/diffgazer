"use client";

import { type ComponentPropsWithRef, type MouseEvent, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useAccordionContext, useAccordionItemContext } from "./accordion-context";

const triggerVariants = cva(
  "flex w-full items-center gap-2 font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
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
  }
);

export interface AccordionTriggerProps
  extends Omit<ComponentPropsWithRef<"button">, "children">,
    Omit<VariantProps<typeof triggerVariants>, "disabled"> {
  children: ReactNode;
  /** Custom handle element. Defaults to an animated Chevron. Pass `null` to hide. */
  handle?: ReactNode | null;
}

export function AccordionTrigger({
  children,
  className,
  variant,
  handle,
  disabled: triggerDisabled,
  ref,
  onClick,
  ...props
}: AccordionTriggerProps) {
  const { onToggle, collapsible } = useAccordionContext();
  const { value, isOpen, disabled, triggerId, contentId } = useAccordionItemContext();

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

  return (
    <button
      {...props}
      ref={ref}
      type="button"
      id={triggerId}
      data-value={value}
      data-diffgazer-navigation-item="button"
      data-disabled={isDisabled ? "" : undefined}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isAriaDisabled || disabled || undefined}
      aria-expanded={isOpen}
      aria-controls={contentId}
      className={cn(triggerVariants({ variant, disabled: isDisabled || isAriaDisabled }), className)}
    >
      {resolvedHandle}
      {children}
    </button>
  );
}
