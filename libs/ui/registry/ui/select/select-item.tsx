"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useSelectContext } from "./select-context";
import { matchesSearch } from "@/lib/search";
import { isValueSelected, toOptionId } from "./select-utils";

const NBSP = "\u00a0";
const BULLET = "\u25cf";
const CHECKMARK = "\u2713";

const selectItemVariants = cva(
  "flex items-center gap-2 px-2 py-1.5 text-sm font-mono cursor-pointer",
  {
    variants: {
      state: {
        default: "text-foreground/60",
        highlighted: "bg-secondary text-foreground",
        selected: "bg-foreground text-background font-medium",
        selectedMulti: "text-foreground",
        selectedMultiHighlighted: "bg-secondary text-foreground",
      },
      variant: {
        default: "",
        card: "",
      },
    },
    compoundVariants: [
      { variant: "card", state: ["default", "selectedMulti"], class: "text-muted-foreground hover:bg-border/30" },
      { variant: "card", state: "highlighted", class: "text-muted-foreground bg-border/30" },
      { variant: "card", state: ["selected", "selectedMultiHighlighted"], class: "bg-muted-foreground text-white font-medium" },
    ],
    defaultVariants: { state: "default", variant: "default" },
  }
);

type ItemState = "default" | "highlighted" | "selected" | "selectedMulti" | "selectedMultiHighlighted";

function getItemState(isSelected: boolean, isHighlighted: boolean, multiple: boolean): ItemState {
  if (!isSelected) return isHighlighted ? "highlighted" : "default";
  if (multiple) return isHighlighted ? "selectedMultiHighlighted" : "selectedMulti";
  return "selected";
}

export type SelectItemIndicator = "auto" | "checkbox" | "radio" | "none";

export interface SelectItemProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  /** Controls the selection indicator shown before the item label.
   * - `"auto"` (default): `[x]`/`[ ]` in multiple mode, `✓` in single mode
   * - `"checkbox"`: always shows `[x]`/`[ ]`
   * - `"radio"`: shows `[ • ]`/`[ ]` radio-style
   * - `"none"`: no indicator (text-only)
   */
  indicator?: SelectItemIndicator;
  /** Text for search/typeahead matching. Defaults to children text or value. */
  textValue?: string;
  className?: string;
}

function renderIndicator(
  mode: SelectItemIndicator,
  isSelected: boolean,
  isMultiple: boolean,
): string | null {
  if (mode === "none") return null;
  if (mode === "checkbox" || (mode === "auto" && isMultiple)) {
    return isSelected ? "[x]" : "[ ]";
  }
  if (mode === "radio") {
    return isSelected ? `[${NBSP}${BULLET}${NBSP}]` : `[${NBSP}${NBSP}${NBSP}]`;
  }
  return isSelected ? CHECKMARK : null;
}

export function SelectItem({
  value: itemValue,
  children,
  disabled = false,
  indicator = "auto",
  textValue,
  className,
}: SelectItemProps) {
  const {
    value,
    multiple,
    highlighted,
    onHighlight,
    searchQuery,
    selectItem,
    variant,
    listboxId,
    labelsRef,
  } = useSelectContext("SelectItem");

  const label = textValue ?? (typeof children === "string" ? children : itemValue);

  useLayoutEffect(() => {
    labelsRef.current.set(itemValue, label);
    return () => { labelsRef.current.delete(itemValue); };
  }, [itemValue, label, labelsRef]);

  const isSelected = isValueSelected(value, itemValue);

  if (!matchesSearch(label, searchQuery)) return null;

  const isHighlighted = highlighted === itemValue;
  const state = getItemState(isSelected, isHighlighted, multiple);
  const indicatorText = renderIndicator(indicator, isSelected, multiple);
  const showIndicatorSlot = indicator !== "none";

  return (
    <div
      id={toOptionId(listboxId, itemValue)}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      data-value={itemValue}
      data-label={label}
      onClick={() => { if (!disabled) selectItem(itemValue); }}
      onMouseEnter={() => { if (!disabled) onHighlight(itemValue); }}
      className={cn(
        selectItemVariants({ state, variant }),
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {showIndicatorSlot && (
        <span className={cn(
          "font-mono shrink-0 whitespace-nowrap min-w-[3ch]",
          !indicatorText && "invisible"
        )}>
          {indicatorText ?? CHECKMARK}
        </span>
      )}
      <span>{children}</span>
      {variant === "card" && isHighlighted && isSelected && (
        <span aria-hidden="true" className="ml-auto text-[10px] animate-pulse">&lt;</span>
      )}
    </div>
  );
}
