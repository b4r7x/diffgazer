"use client";

import type { ComponentProps } from "react";
import { useRequiredCodeBlockContext } from "./code-block-context";

export type CodeBlockHeaderProps = ComponentProps<"div">;

export function CodeBlockHeader({ className, ref, ...props }: CodeBlockHeaderProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Header");
  if (context.variant === "bare") return null;
  return <div ref={ref} data-slot="code-block-header" className={className} {...props} />;
}
