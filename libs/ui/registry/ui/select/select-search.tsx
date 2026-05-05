"use client";

import { useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { useSelectContext } from "./select-context";
import { toOptionId } from "./select-utils";

export interface SelectSearchProps {
  placeholder?: string;
  position?: "top" | "bottom";
  className?: string;
  "aria-label"?: string;
}

function searchBorderClass(variant: string, position: string): string {
  if (variant === "card") return "border-b border-foreground";
  if (position === "top") return "border-b border-border";
  return "border-t border-border";
}

export function SelectSearch({
  placeholder = "Search...",
  position = "bottom",
  className,
  "aria-label": ariaLabel,
}: SelectSearchProps) {
  const { open, searchQuery, onSearchChange, variant, searchInputRef, highlighted, listboxId } = useSelectContext("SelectSearch");

  useLayoutEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open, searchInputRef]);

  if (!open) return null;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2", searchBorderClass(variant, position))}>
      <span className="text-foreground/50 text-sm font-mono shrink-0">
        &gt;
      </span>
      <input
        ref={searchInputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel ?? "Search options"}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={highlighted ? toOptionId(listboxId, highlighted) : undefined}
        aria-autocomplete="list"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "text-sm bg-transparent text-foreground w-full outline-none font-mono placeholder:text-foreground/30",
          className,
        )}
      />
    </div>
  );
}
