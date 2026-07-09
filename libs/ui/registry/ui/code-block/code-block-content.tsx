"use client";

import { Children, type ComponentProps } from "react";
import { ScrollArea } from "../scroll-area/scroll-area";
import { useRequiredCodeBlockContext } from "./code-block-context";
import { CodeBlockLine } from "./code-block-line";

/** Props for code block content. */
export interface CodeBlockContentProps extends ComponentProps<"div"> {
  /** Auto-split mode only. Renders a line-number gutter for string children. */
  showLineNumbers?: boolean;
  lineCount?: number;
}

/** Scrollable <pre> body (auto-split or composed) */
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
  const resolvedLabelledBy =
    ariaLabelledBy ?? (hasExplicitName || !context.hasLabel ? undefined : context.labelId);
  let resolvedLabel: string | undefined = context.fallbackName;
  if (hasExplicitName) {
    resolvedLabel = ariaLabel;
  } else if (context.hasLabel) {
    resolvedLabel = undefined;
  }

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
      <pre
        data-slot="code-block-content"
        style={{ "--code-block-line-number-w": `${gutterWidth}ch` } as React.CSSProperties}
      >
        {lines
          ? lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: code lines render in fixed source order and are never reordered; the line index is the stable identity (line content can repeat).
              <CodeBlockLine key={i} number={showLineNumbers ? i + 1 : undefined} content={line} />
            ))
          : children}
      </pre>
    </ScrollArea>
  );
}
