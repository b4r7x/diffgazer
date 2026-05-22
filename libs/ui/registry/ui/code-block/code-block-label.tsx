"use client";

import type { ComponentProps } from "react";
import { useRequiredCodeBlockContext } from "./code-block-context";

export type CodeBlockLabelProps = ComponentProps<"span">;

export function CodeBlockLabel({ id, className, children, ref, ...props }: CodeBlockLabelProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Label");
  const resolvedId = id ?? context.labelId;

  return (
    <span
      ref={ref}
      id={resolvedId}
      data-slot="code-block-label"
      className={className}
      {...props}
    >
      {children}
    </span>
  );
}
