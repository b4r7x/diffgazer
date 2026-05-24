"use client";

import { Children, type ComponentProps } from "react";
import { ScrollArea } from "../scroll-area/scroll-area";
import { CodeBlockLine } from "./code-block-line";
import { useRequiredCodeBlockContext } from "./code-block-context";

export interface CodeBlockContentProps extends ComponentProps<"div"> {
  showLineNumbers?: boolean;
  /** Total line count — used to fix gutter width. Inferred automatically when omitted. */
  lineCount?: number;
}

export function CodeBlockContent({
  showLineNumbers = true,
  lineCount: lineCountProp,
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

  const isString = typeof children === "string";
  const lines = isString ? (children as string).split("\n") : null;
  const lineCount = lineCountProp ?? (lines ? lines.length : Children.count(children));
  const gutterWidth = Math.max(String(lineCount).length, 2);

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
      <pre data-slot="code-block-content" style={{ "--cb-line-number-w": `${gutterWidth}ch` } as React.CSSProperties}>
        {lines
          ? lines.map((line, i) => (
              <CodeBlockLine key={i} number={showLineNumbers ? i + 1 : undefined} content={line} />
            ))
          : children}
      </pre>
    </ScrollArea>
  );
}
