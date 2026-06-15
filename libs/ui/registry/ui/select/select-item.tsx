"use client";

import { cva } from "class-variance-authority";
import {
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
} from "react";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { OverflowText } from "../overflow/overflow-text";
import { useSelectContext } from "./select-context";
import { getNodeText, isValueSelected, toOptionId } from "./selection";

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
      {
        variant: "card",
        state: ["default", "selectedMulti"],
        className: "text-muted-foreground hover:bg-border/30",
      },
      { variant: "card", state: "highlighted", className: "text-muted-foreground bg-border/30" },
      {
        variant: "card",
        state: ["selected", "selectedMultiHighlighted"],
        className: "bg-muted-foreground text-background font-medium",
      },
    ],
    defaultVariants: { state: "default", variant: "default" },
  },
);

/** Allowed item state values. */
type ItemState =
  | "default"
  | "highlighted"
  | "selected"
  | "selectedMulti"
  | "selectedMultiHighlighted";

function getItemState(isSelected: boolean, isHighlighted: boolean, multiple: boolean): ItemState {
  if (!isSelected) return isHighlighted ? "highlighted" : "default";
  if (multiple) return isHighlighted ? "selectedMultiHighlighted" : "selectedMulti";
  return "selected";
}

/**
 * Dropdown select with search, multiple selection, card variant, and controlled keyboard
 * integration points. 8 composable parts.
 */
export type SelectItemIndicator = "auto" | "checkbox" | "radio" | "none";

/** Props for select item. */
export interface SelectItemProps<TValue extends string = string>
  extends Omit<ComponentPropsWithRef<"div">, "children" | "onSelect"> {
  /** Item value. Must be unique within the Select. */
  value: TValue;
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Disable the option. */
  disabled?: boolean;
  /**
   * Selection indicator style. "auto" picks checkbox in multi mode and a check mark in single
   * mode.
   */
  indicator?: SelectItemIndicator;
  /** Override the searchable/typeahead text when children are not plain text. */
  textValue?: string;
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

/**
 * Selectable option. indicator prop: auto/checkbox/radio/none. textValue prop for custom search
 * text.
 */
export function SelectItem<TValue extends string = string>({
  value: itemValue,
  children,
  disabled = false,
  indicator = "auto",
  textValue,
  className,
  ref,
  onClick,
  onMouseEnter,
  ...props
}: SelectItemProps<TValue>) {
  const {
    value,
    open,
    multiple,
    highlighted,
    searchQuery,
    selectItem,
    registerOption,
    unregisterOption,
    options,
    variant,
    listboxId,
  } = useSelectContext("SelectItem");

  // One derivation for registration and the visibility filter: textValue wins,
  // then the flattened node text (icon + text JSX), then the raw value.
  const label = textValue ?? getNodeText(children) ?? itemValue;

  useLayoutEffect(() => {
    registerOption(itemValue, { label, disabled });
    return () => unregisterOption(itemValue);
  }, [registerOption, unregisterOption, itemValue, label, disabled]);

  const isSelected = isValueSelected(value, itemValue);

  // Read the registered label so the filter matches the same text the metadata
  // (typeahead, match count, active descendant) uses; fall back to the local
  // derivation on the first render before registration commits.
  const filterLabel = options.get(itemValue)?.label ?? label;

  if (!open) return null;
  if (!matchesSearch(filterLabel, searchQuery)) return null;

  const isHighlighted = !disabled && highlighted === itemValue;
  const state = getItemState(isSelected, isHighlighted, multiple);
  const indicatorText = renderIndicator(indicator, isSelected, multiple);
  const showIndicatorSlot = indicator !== "none";

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && !disabled) selectItem(itemValue);
  };

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA listbox pattern — option stays non-focusable while the listbox container holds focus and aria-activedescendant tracks the active option.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space selection is handled centrally by the select listbox, not per option.
    <div
      {...props}
      ref={ref}
      id={toOptionId(listboxId, itemValue)}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      data-value={itemValue}
      data-label={label}
      data-highlighted={isHighlighted ? "" : undefined}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        selectItemVariants({ state, variant }),
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {showIndicatorSlot && (
        <span
          aria-hidden="true"
          className={cn(
            "font-mono shrink-0 whitespace-nowrap min-w-[3ch]",
            !indicatorText && "invisible",
          )}
        >
          {indicatorText ?? CHECKMARK}
        </span>
      )}
      {typeof children === "string" ? (
        <OverflowText className="flex-1 min-w-0">{children}</OverflowText>
      ) : (
        // Non-string children skip OverflowText (which requires `children: string`);
        // consumers using JSX labels should ensure their items fit or wrap manually.
        <span className="flex-1 min-w-0 truncate">{children}</span>
      )}
      {variant === "card" && isHighlighted && isSelected && (
        <span aria-hidden="true" className="ml-auto text-2xs motion-safe:animate-pulse">
          &lt;
        </span>
      )}
    </div>
  );
}
