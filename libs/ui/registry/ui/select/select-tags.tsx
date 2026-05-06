"use client";

import { cn } from "@/lib/utils";
import { useSelectContext } from "./select-context";
import { toSelectedArray } from "./select-utils";

export interface SelectTagsProps {
  placeholder?: string;
  className?: string;
}

export function SelectTags({ placeholder = "Select...", className }: SelectTagsProps) {
  const { value, multiple, labelsRef, variant } = useSelectContext("SelectTags");

  if (!multiple) return null;

  const selected = toSelectedArray(value, multiple);

  if (selected.length === 0) {
    return <span className={variant === "card" ? "text-accent-foreground/50" : "text-foreground/50"}>{placeholder}</span>;
  }

  return (
    <span className={cn("flex flex-wrap gap-1 flex-1 min-w-0", className)}>
      {selected.map((v) => {
        const label = labelsRef.current.get(v)?.label ?? v;
        return (
          <span
            key={v}
            className="inline-flex items-center gap-0.5 font-mono text-xs border border-foreground/40 px-1 text-foreground whitespace-nowrap"
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}
