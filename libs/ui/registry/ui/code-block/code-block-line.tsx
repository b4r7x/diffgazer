"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** @see @diffgazer/registry docs-data CodeBlockToken (base without `className`) */
export interface CodeBlockToken {
  text: string;
  color?: string;
  className?: string;
}

export type CodeBlockLineType = "highlight" | "added" | "removed";

export interface CodeBlockLineProps extends Omit<ComponentProps<"span">, "content"> {
  number?: number;
  content: string | CodeBlockToken[];
  type?: CodeBlockLineType;
}

export function CodeBlockLine({ number, content, type, className, ref, ...props }: CodeBlockLineProps) {
  return (
    <span ref={ref} className={cn("flex", type === "highlight" && "bg-muted/50", className)} {...props}>
      {number != null && (
        <span aria-hidden="true" className="w-8 text-muted-foreground border-r border-border mr-2 text-right pr-1 select-none shrink-0">
          {number}
        </span>
      )}
      {(type === "added" || type === "removed") && (
        <span className="sr-only">{type === "added" ? "Added: " : "Removed: "}</span>
      )}
      <code className={cn("whitespace-pre", type === "added" && "text-success", type === "removed" && "text-destructive")}>
        {typeof content === "string"
          ? content
          : content.map((token, i) => (
              <span key={i} style={{ color: token.color }} className={token.className}>
                {token.text}
              </span>
            ))}
      </code>
    </span>
  );
}
