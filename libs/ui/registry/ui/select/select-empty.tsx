"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSelectContext } from "./select-context";
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

function hasMatch(labels: Map<string, string>, query: string): boolean {
  for (const label of labels.values()) {
    if (matchesSearch(label, query)) return true;
  }
  return false;
}
