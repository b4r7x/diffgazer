"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useRequiredCodeBlockContext } from "./code-block-context";

export type CodeBlockLabelProps = ComponentProps<"span">;

export function CodeBlockLabel({ id, className, children, ref, ...props }: CodeBlockLabelProps) {
  const context = useRequiredCodeBlockContext("CodeBlock.Label");
  return (
    <span
      ref={ref}
      id={id ?? context.labelId}
      data-slot="code-block-label"
      className={cn(className)}
      {...props}
    >
      {children}
    </span>
  );
}
