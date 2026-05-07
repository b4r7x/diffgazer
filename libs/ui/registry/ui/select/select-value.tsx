"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSelectContext, type SelectOptionMetadata } from "./select-context";
import { toSelectedArray } from "./select-utils";

export type SelectValueDisplay = "count" | "list" | "truncate";

export interface SelectValueRenderProps {
  selected: string[];
  labels: ReadonlyMap<string, string>;
}

function getLabelMap(options: ReadonlyMap<string, SelectOptionMetadata>): ReadonlyMap<string, string> {
  return new Map(Array.from(options, ([value, option]) => [value, option.label]));
}

export interface SelectValueProps {
  placeholder?: ReactNode;
  display?: SelectValueDisplay;
  truncateAfter?: number;
  className?: string;
  children?: ((props: SelectValueRenderProps) => ReactNode) | ReactNode;
}

function MultiValue({
  selected,
  options,
  display,
  truncateAfter,
}: {
  selected: string[];
  options: ReadonlyMap<string, SelectOptionMetadata>;
  display: SelectValueDisplay;
  truncateAfter: number;
}): ReactNode {
  if (selected.length === 1) {
    const firstSelected = selected[0];
    return firstSelected === undefined ? null : <span>{options.get(firstSelected)?.label ?? firstSelected}</span>;
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
          {overflow > 0 && ` +${overflow} more`}
        </span>
      );
    }

    case "count":
    default:
      return <span>{selected.length} selected</span>;
  }
}

export function SelectValue({
  placeholder = "Select...",
  display = "count",
  truncateAfter = 2,
  className,
  children,
}: SelectValueProps) {
  const { value, multiple, options, variant } = useSelectContext("SelectValue");

  const selected = toSelectedArray(value, multiple);

  if (selected.length === 0) {
    return (
      <span className={cn(
        variant === "card" ? "text-accent-foreground/50" : "text-foreground/50",
        className,
      )}>
        {placeholder}
      </span>
    );
  }

  if (typeof children === "function") {
    return <span className={className}>{children({ selected, labels: getLabelMap(options) })}</span>;
  }

  return (
    <span className={className}>
      <MultiValue selected={selected} options={options} display={display} truncateAfter={truncateAfter} />
    </span>
  );
}
