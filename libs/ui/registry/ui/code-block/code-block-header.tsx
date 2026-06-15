"use client";

import type { ComponentProps } from "react";
import { useRequiredCodeBlockContext } from "./code-block-context";

/** Props for code block header. */
export type CodeBlockHeaderProps = ComponentProps<"div">;

/** Header row (filename + actions); hidden in bare variant. */
export function CodeBlockHeader({ className, ref, ...props }: CodeBlockHeaderProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Header");
  if (context.variant === "bare") return null;
  return <div ref={ref} data-slot="code-block-header" className={className} {...props} />;
}
