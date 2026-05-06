"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSelectContext, type SelectOptionMetadata } from "./select-context";
import { matchesSearch } from "@/lib/search";

export interface SelectEmptyProps {
  children?: ReactNode;
  className?: string;
}

export function SelectEmpty({ children, className }: SelectEmptyProps) {
  const { searchQuery, labelsRef } = useSelectContext("SelectEmpty");

  if (!searchQuery || hasMatch(labelsRef.current, searchQuery)) return null;

  return (
    <div
      className={cn(
        "px-3 py-4 text-sm font-mono text-muted-foreground",
        className
      )}
    >
      {children ?? "> no results."}
    </div>
  );
}

function hasMatch(labels: Map<string, SelectOptionMetadata>, query: string): boolean {
  for (const option of labels.values()) {
    if (matchesSearch(option.label, query)) return true;
  }
  return false;
}
