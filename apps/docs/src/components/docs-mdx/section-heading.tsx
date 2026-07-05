import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

interface SectionHeadingProps extends Omit<ComponentPropsWithoutRef<"h2">, "color"> {
  /** Optional control rendered at the end of the row, after the trailing rule. */
  action?: ReactNode;
}

/**
 * Prompt-style section heading: a `❯` marker rendered as a CSS pseudo-element so
 * it stays out of the heading's textContent (which the table of contents syncs
 * its labels from), the heading text, a trailing hairline rule, and an optional
 * end-slot action. Stays a semantic h2 so anchor ids and the table of contents
 * keep working.
 */
export function SectionHeading({ children, className, id, action, ...props }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center gap-3 mt-12 mb-5", className)}>
      <Typography
        as="h2"
        size="xl"
        id={id}
        className="flex items-center gap-3 font-bold text-foreground scroll-mt-16 before:font-normal before:text-muted-foreground before:content-['❯']"
        {...props}
      >
        <span>{children}</span>
      </Typography>
      <span aria-hidden="true" className="flex-1 border-t border-border/60" />
      {action}
    </div>
  );
}
