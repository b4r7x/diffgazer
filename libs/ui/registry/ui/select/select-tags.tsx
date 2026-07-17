"use client";

import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useSelectContext } from "./select-context";
import { toSelectedArray } from "./selection";

const selectTagsPlaceholderVariants = cva("", {
  variants: {
    variant: {
      default: "text-foreground/55",
      card: "text-accent-foreground/55",
    },
  },
  defaultVariants: { variant: "default" },
});

/** Props for select tags. */
export interface SelectTagsProps {
  /** String rendered when nothing is selected. Only available in multi-select mode. */
  placeholder?: string;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Displays selected items as outlined chips (multiple select) */
export function SelectTags({ placeholder = "Select...", className }: SelectTagsProps) {
  const { value, multiple, options, variant } = useSelectContext("SelectTags");

  if (!multiple) return null;

  const selected = toSelectedArray(value, multiple);

  if (selected.length === 0) {
    return (
      <span className={cn(selectTagsPlaceholderVariants({ variant }), className)}>
        {placeholder}
      </span>
    );
  }

  return (
    <span className={cn("flex flex-wrap gap-1 flex-1 min-w-0", className)}>
      {selected.map((v) => {
        const label = options.get(v)?.label ?? v;
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
