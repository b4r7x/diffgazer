"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../scroll-area/scroll-area";
import { CodeBlockLine } from "./code-block-line";
import { useRequiredCodeBlockContext } from "./code-block-context";

export type CodeBlockContentTone = "default" | "diff";

export interface CodeBlockContentProps extends ComponentProps<"div"> {
  showLineNumbers?: boolean;
  /**
   * Surfaces as `data-tone` for styling hooks. Use "diff" when the content
   * contains added/removed lines so wrappers can tighten gutter spacing.
   */
  tone?: CodeBlockContentTone;
}

export function CodeBlockContent({
  showLineNumbers = true,
  tone = "default",
  className,
  children,
  ref,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: CodeBlockContentProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Content");
  // ScrollArea adds role="region" when it has an accessible name. Match the
  // figure's accessible name: prefer aria-labelledby pointing at the rendered
  // CodeBlock.Label (so a single label names both region and figure), and
  // fall through to the context's fallback name when no Label is rendered.
  const hasExplicitName = Boolean(ariaLabel || ariaLabelledBy);
  const resolvedLabelledBy = ariaLabelledBy ?? (hasExplicitName ? undefined : context.labelId);
  const resolvedLabel = hasExplicitName ? ariaLabel : context.fallbackName;

  return (
    <ScrollArea
      orientation="both"
      tabIndex={0}
      ref={ref}
      aria-label={resolvedLabel}
      aria-labelledby={resolvedLabelledBy}
      className={cn(className)}
      {...props}
    >
      <pre data-slot="code-block-content" data-tone={tone}>
        {typeof children === "string"
          ? children.split("\n").map((line, i) => (
              <CodeBlockLine key={i} number={showLineNumbers ? i + 1 : undefined} content={line} />
            ))
          : children}
      </pre>
    </ScrollArea>
  );
}
