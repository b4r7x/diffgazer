"use client";

import { type ComponentProps, useId, useLayoutEffect } from "react";
import { useRequiredCodeBlockContext } from "./code-block-context";

/** Props for code block label. */
export type CodeBlockLabelProps = ComponentProps<"span">;

/** Filename label, wired to figure's accessible name. */
export function CodeBlockLabel({ id, className, children, ref, ...props }: CodeBlockLabelProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Label");
  const { registerLabel } = context;
  const implicitId = useId();
  const resolvedId = id ?? implicitId;

  useLayoutEffect(() => registerLabel(resolvedId), [registerLabel, resolvedId]);

  return (
    <span ref={ref} id={resolvedId} data-slot="code-block-label" className={className} {...props}>
      {children}
    </span>
  );
}
