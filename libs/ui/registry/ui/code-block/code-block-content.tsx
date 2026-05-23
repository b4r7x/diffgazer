"use client";

import type { ComponentProps } from "react";
import { ScrollArea } from "../scroll-area/scroll-area";
import { CodeBlockLine } from "./code-block-line";
import { useRequiredCodeBlockContext } from "./code-block-context";

export interface CodeBlockContentProps extends ComponentProps<"div"> {
  showLineNumbers?: boolean;
}

export function CodeBlockContent({
  showLineNumbers = true,
  className,
  children,
  ref,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: CodeBlockContentProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Content");
  const hasExplicitName = Boolean(ariaLabel || ariaLabelledBy);
  // Only reference labelId when a CodeBlock.Label is actually rendered,
  // otherwise the aria-labelledby would point at a non-existent element.
  const resolvedLabelledBy = ariaLabelledBy ?? (hasExplicitName || !context.hasLabel ? undefined : context.labelId);
  const resolvedLabel = hasExplicitName ? ariaLabel : (context.hasLabel ? undefined : context.fallbackName);

  return (
    <ScrollArea
      orientation="both"
      tabIndex={0}
      ref={ref}
      aria-label={resolvedLabel}
      aria-labelledby={resolvedLabelledBy}
      className={className}
      {...props}
    >
      <pre data-slot="code-block-content">
        {typeof children === "string"
          ? children.split("\n").map((line, i) => (
              <CodeBlockLine key={i} number={showLineNumbers ? i + 1 : undefined} content={line} />
            ))
          : children}
      </pre>
    </ScrollArea>
  );
}
