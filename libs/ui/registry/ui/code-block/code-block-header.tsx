"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type CodeBlockHeaderProps = ComponentProps<"div">;

export function CodeBlockHeader({ className, ref, ...props }: CodeBlockHeaderProps) {
  return <div ref={ref} className={cn("flex items-center justify-between px-4 py-2 border-b border-border bg-border/10", className)} {...props} />;
}
