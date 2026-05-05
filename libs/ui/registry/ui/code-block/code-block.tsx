"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface CodeBlockProps extends ComponentProps<"div"> {
  language?: string;
  label?: string;
}

export function CodeBlock({ language, label, className, children, ref, ...props }: CodeBlockProps) {
  return (
    <div ref={ref} role="region" aria-roledescription="code block" aria-label={label ?? (language ? `${language} code` : "Code block")} data-language={language} className={cn("border border-border bg-background overflow-hidden rounded-sm", className)} {...props}>
      {children}
    </div>
  );
}
