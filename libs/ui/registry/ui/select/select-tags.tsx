"use client";

import { cn } from "@/lib/utils";
import { useSelectContext } from "./select-context";
import { toSelectedArray } from "./select-utils";

const REMOVE_SYMBOL = "\u2715";

export interface SelectTagsProps {
  placeholder?: string;
  className?: string;
}

export function SelectTags({ placeholder = "Select...", className }: SelectTagsProps) {
  const { value, multiple, labelsRef, selectItem, variant } = useSelectContext("SelectTags");

  if (!multiple) return null;

  const selected = toSelectedArray(value, multiple);

  if (selected.length === 0) {
    return <span className={variant === "card" ? "text-accent-foreground/50" : "text-foreground/50"}>{placeholder}</span>;
  }

  return (
    <span className={cn("flex flex-wrap gap-1 flex-1 min-w-0", className)}>
      {selected.map((v) => {
        const label = labelsRef.current.get(v) ?? v;
        return (
          <span
            key={v}
            className="inline-flex items-center gap-0.5 font-mono text-xs border border-foreground/40 px-1 text-foreground whitespace-nowrap"
          >
            {label}
            <button
              type="button"
              aria-label={`Remove ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                selectItem(v);
              }}
              className="ml-0.5 hover:opacity-70 cursor-pointer inline-flex items-center justify-center bg-transparent border-none p-0 text-inherit min-h-[44px] min-w-[44px]"
            >
              {REMOVE_SYMBOL}
            </button>
          </span>
        );
      })}
    </span>
  );
}
