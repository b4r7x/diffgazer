"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for toc. */
export interface TocProps extends Omit<ComponentPropsWithRef<"nav">, "title"> {
  /** Heading text and accessible label for the nav landmark. */
  title?: string;
  /** Heading level used for the title. */
  as?: "h2" | "h3" | "h4";
}

/** Root aside wrapper and optional heading label. */
export function Toc({
  title = "On this page",
  as: Heading = "h2",
  className,
  children,
  ref,
  ...props
}: TocProps) {
  return (
    <nav
      ref={ref}
      data-slot="toc"
      aria-label={title}
      className={cn("w-56 shrink-0 py-8 pr-4", className)}
      {...props}
    >
      <Heading className="mb-3 text-2xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
        {title}
      </Heading>
      {children}
    </nav>
  );
}
