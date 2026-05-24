"use client";

import { useLayoutEffect } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { useSelectContext } from "./select-context";
import { isActiveOptionVisible, toOptionId } from "./select-utils";

export interface SelectSearchProps {
  placeholder?: string;
  position?: "top" | "bottom";
  className?: string;
  "aria-label"?: string;
}

const selectSearchVariants = cva("flex items-center gap-2 px-3 py-2", {
  variants: {
    variant: {
      default: "",
      card: "border-b border-foreground",
    },
    position: {
      top: "",
      bottom: "",
    },
  },
  compoundVariants: [
    { variant: "default", position: "top", className: "border-b border-border" },
    { variant: "default", position: "bottom", className: "border-t border-border" },
  ],
  defaultVariants: { variant: "default", position: "bottom" },
});

export function SelectSearch({
  placeholder = "Search...",
  position = "bottom",
  className,
  "aria-label": ariaLabel,
}: SelectSearchProps) {
  const {
    open,
    searchQuery,
    onSearchChange,
    variant,
    searchInputRef,
    ariaInvalid,
    ariaLabelledBy,
    required,
    options,
    highlighted,
    listboxId,
  } = useSelectContext("SelectSearch");
  const activeDescendant = isActiveOptionVisible(options, highlighted, searchQuery, matchesSearch)
    ? toOptionId(listboxId, highlighted)
    : undefined;

  useLayoutEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open, searchInputRef]);

  if (!open) return null;

  return (
    <div className={selectSearchVariants({ variant, position })}>
      <span className="text-foreground/50 text-sm font-mono shrink-0">
        &gt;
      </span>
      <input
        ref={searchInputRef}
        type="search"
        role="combobox"
        aria-labelledby={ariaLabelledBy || undefined}
        aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? "Search options")}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-required={required}
        aria-invalid={ariaInvalid}
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
