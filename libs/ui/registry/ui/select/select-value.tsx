"use client";

import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type SelectOptionMetadata, useSelectContext } from "./select-context";
import { toSelectedArray } from "./selection";

const selectValuePlaceholderVariants = cva("", {
  variants: {
    variant: {
      // 55% keeps placeholder text at >=4.5:1 (WCAG AA) on --background.
      default: "text-foreground/55",
      card: "text-accent-foreground/55",
    },
  },
  defaultVariants: { variant: "default" },
});

/**
 * Dropdown select with search, multiple selection, card variant, and controlled keyboard
 * integration points. 8 composable parts.
 */
export type SelectValueDisplay = "count" | "list" | "truncate";

/** Props for select value render. */
export interface SelectValueRenderProps {
  /** Marks the item as selected. */
  selected: string[];
  labels: ReadonlyMap<string, string>;
}

function getLabelMap(
  options: ReadonlyMap<string, SelectOptionMetadata>,
): ReadonlyMap<string, string> {
  return new Map(Array.from(options, ([value, option]) => [value, option.label]));
}

/** Props for select value. */
export interface SelectValueProps {
  /** Rendered when nothing is selected. */
  placeholder?: ReactNode;
  /**
   * Multi-select display mode. "count" shows N selected, "list" comma-separates, "truncate"
   * shows first N + "+M more".
   */
  display?: SelectValueDisplay;
  /** Finite nonnegative integer count shown before "+N more" when display="truncate". */
  truncateAfter?: number;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /**
   * Render function for fully custom selection display. Example: selected.map((value) =>
   * labels.get(value) ?? value).join(', ').
   */
  children?: (props: SelectValueRenderProps) => ReactNode;
  /** "N selected" summary text (count display). Defaults to `${count} selected`. */
  getSelectedLabel?: (count: number) => string;
  /** "+N more" overflow text (truncate display). Defaults to ` +${count} more`. */
  getOverflowLabel?: (count: number) => string;
}

function MultiValue({
  selected,
  options,
  display,
  truncateAfter,
  getSelectedLabel,
  getOverflowLabel,
}: {
  selected: string[];
  options: ReadonlyMap<string, SelectOptionMetadata>;
  display: SelectValueDisplay;
  truncateAfter: number;
  getSelectedLabel?: (count: number) => string;
  getOverflowLabel?: (count: number) => string;
}): ReactNode {
  if (selected.length === 1) {
    const firstSelected = selected[0];
    return firstSelected === undefined ? null : (
      <span>{options.get(firstSelected)?.label ?? firstSelected}</span>
    );
  }

  const labels = selected.map((v) => options.get(v)?.label ?? v);

  switch (display) {
    case "list":
      return <span>{labels.join(", ")}</span>;

    case "truncate": {
      const visible = labels.slice(0, truncateAfter);
      const overflow = labels.length - truncateAfter;
      return (
        <span>
          {visible.join(", ")}
          {overflow > 0 && (getOverflowLabel?.(overflow) ?? ` +${overflow} more`)}
        </span>
      );
    }

    default:
      return <span>{getSelectedLabel?.(selected.length) ?? `${selected.length} selected`}</span>;
  }
}

/**
 * Displays selected value or placeholder. Props: display (count|list|truncate), truncateAfter,
 * children as render function.
 */
export function SelectValue({
  placeholder = "Select...",
  display = "count",
  truncateAfter = 2,
  className,
  children,
  getSelectedLabel,
  getOverflowLabel,
}: SelectValueProps) {
  const { value, multiple, options, variant } = useSelectContext("SelectValue");

  const selected = toSelectedArray(value, multiple);
  const normalizedTruncateAfter = Number.isFinite(truncateAfter)
    ? Math.max(0, Math.floor(truncateAfter))
    : 0;
  // Treat "" as unset unless the consumer explicitly registers an option with value="".
  const isUnsetEmptyString =
    !multiple && selected.length === 1 && selected[0] === "" && !options.has("");

  if (selected.length === 0 || isUnsetEmptyString) {
    return (
      <span className={cn(selectValuePlaceholderVariants({ variant }), className)}>
        {placeholder}
      </span>
    );
  }

  if (children !== undefined) {
    return (
      <span className={className}>{children({ selected, labels: getLabelMap(options) })}</span>
    );
  }

  return (
    <span className={className}>
      <MultiValue
        selected={selected}
        options={options}
        display={display}
        truncateAfter={normalizedTruncateAfter}
        getSelectedLabel={getSelectedLabel}
        getOverflowLabel={getOverflowLabel}
      />
    </span>
  );
}
