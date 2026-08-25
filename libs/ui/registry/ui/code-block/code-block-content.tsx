"use client";

import {
  Children,
  type ComponentProps,
  type CSSProperties,
  isValidElement,
  type ReactNode,
} from "react";
import { ScrollArea } from "../scroll-area/scroll-area";
import { useRequiredCodeBlockContext } from "./code-block-context";
import { CodeBlockLine, type CodeBlockLineProps } from "./code-block-line";

export interface CodeBlockContentProps extends ComponentProps<"div"> {
  /** Auto-split mode only. Renders a line-number gutter for string children. */
  showLineNumbers?: boolean;
  /**
   * Soft-wraps long lines instead of scrolling them horizontally. The line's own
   * flex row is the hanging indent — continuation lines land under the code
   * column, past the gutter. Surfaces as data-wrap="on" on the <pre>.
   */
  wrap?: boolean;
}

/**
 * Widest number a composed body prints. An excerpt lifted out of a file numbers
 * its lines from where they live (105, 106), so counting the lines would size
 * the gutter for "2" and clip "105".
 */
function largestLineNumber(children: ReactNode): number {
  let largest = 0;
  Children.forEach(children, (child) => {
    if (!isValidElement<CodeBlockLineProps>(child)) return;
    const { number } = child.props;
    if (number != null && number > largest) largest = number;
  });
  return largest;
}

/** Scrollable <pre> body (auto-split or composed) */
export function CodeBlockContent({
  showLineNumbers = true,
  wrap = false,
  className,
  children,
  ref,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: CodeBlockContentProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Content");
  const hasExplicitName = ariaLabel !== undefined || ariaLabelledBy !== undefined;
  const resolvedLabel = hasExplicitName ? ariaLabel : context.ariaLabel;
  const resolvedLabelledBy = hasExplicitName ? ariaLabelledBy : context.ariaLabelledBy;

  const lines = typeof children === "string" ? children.split("\n") : null;
  const widestNumber = lines ? lines.length : largestLineNumber(children);
  const gutterWidth = Math.max(String(widestNumber).length, 2);

  return (
    <ScrollArea
      orientation="both"
      ref={ref}
      aria-label={resolvedLabel}
      aria-labelledby={resolvedLabelledBy}
      className={className}
      {...props}
    >
      <pre
        data-slot="code-block-content"
        data-wrap={wrap ? "on" : undefined}
        style={{ "--code-block-line-number-w": `${gutterWidth}ch` } as CSSProperties}
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
