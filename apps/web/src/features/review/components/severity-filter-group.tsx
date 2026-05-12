import { cn } from "@diffgazer/core/cn";
import type { KeyboardEvent, Ref } from "react";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { type UISeverityFilter, SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";

export type SeverityFilter = UISeverityFilter;

export interface SeverityFilterGroupProps {
  counts: Record<ReviewSeverity, number>;
  activeFilter: SeverityFilter;
  onFilterChange: (filter: SeverityFilter) => void;
  isFocused?: boolean;
  focusedIndex?: number;
  onFocusedIndexChange?: (index: number) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function SeverityFilterGroup({
  counts,
  activeFilter,
  onFilterChange,
  isFocused,
  focusedIndex,
  onFocusedIndexChange,
  onKeyDown,
  className,
  ref,
}: SeverityFilterGroupProps) {
  const handleFilterChange = (value: string | null) => {
    if (value === null) {
      onFilterChange("all");
      return;
    }
    const index = SEVERITY_ORDER.findIndex((severity) => severity === value);
    if (index === -1) return;
    onFocusedIndexChange?.(index);
    onFilterChange(SEVERITY_ORDER[index] ?? "all");
  };

  return (
    <ToggleGroup
      ref={ref}
      value={activeFilter === "all" ? null : activeFilter}
      allowDeselect
      onChange={handleFilterChange}
      onHighlightChange={(value) => {
        const index = SEVERITY_ORDER.findIndex((severity) => severity === value);
        if (index >= 0) onFocusedIndexChange?.(index);
      }}
      highlighted={isFocused ? SEVERITY_ORDER[focusedIndex ?? 0] ?? null : null}
      onKeyDown={onKeyDown}
      label="Severity filter"
      className={cn("gap-2 text-xs", className)}
    >
      {SEVERITY_ORDER.map((sev, index) => {
        const count = counts[sev];
        const label = SEVERITY_CONFIG[sev].label;
        return (
          <ToggleGroupItem
            key={sev}
            value={sev}
            aria-label={`${label} severity, ${count} ${count === 1 ? "issue" : "issues"}`}
            className={cn(
              "h-5 min-h-0 min-w-fit px-1.5 text-[11px] inline-flex items-center whitespace-nowrap tabular-nums focus-visible:ring-0 focus-visible:outline-none",
              activeFilter === sev && SEVERITY_CONFIG[sev].color,
              isFocused && focusedIndex === index && "border-tui-blue bg-tui-selection",
            )}
          >
            <span aria-hidden="true">[{label} {count}]</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
