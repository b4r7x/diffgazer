"use client";

import type { ComponentProps } from "react";
import { useRequiredCodeBlockContext } from "./code-block-context";

/** Props for code block label. */
export type CodeBlockLabelProps = ComponentProps<"span">;

/** Filename label, wired to figure's accessible name. */
export function CodeBlockLabel({ id, className, children, ref, ...props }: CodeBlockLabelProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Label");
  const resolvedId = id ?? context.labelId;

  return (
    <span ref={ref} id={resolvedId} data-slot="code-block-label" className={className} {...props}>
      {children}
    </span>
  );
}
