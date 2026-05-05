"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export interface TocProps extends Omit<ComponentPropsWithRef<"nav">, "title"> {
  title?: string;
  as?: "h2" | "h3" | "h4";
}

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
      aria-label={title}
      className={cn("w-56 shrink-0 py-8 pr-4", className)}
      {...props}
    >
      <Heading className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
        {title}
      </Heading>
      {children}
    </nav>
  );
}