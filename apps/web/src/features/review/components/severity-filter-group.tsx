import { formatSeverityFilterLabel } from "@diffgazer/core/review";
import {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type UISeverityFilter,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import { Button } from "@diffgazer/ui/components/button";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { cn } from "@diffgazer/ui/lib/utils";
import type { KeyboardEvent, Ref } from "react";
import { SEVERITY_CONFIG } from "@/components/shared/severity/constants";

export const RESET_FILTER_VALUE = "__reset__";

export interface SeverityFilterGroupProps {
  counts: Record<ReviewSeverity, number>;
  activeFilter: UISeverityFilter;
  onFilterChange: (filter: UISeverityFilter) => void;
  onReset?: () => void;
  onNavigationBoundaryReached?: (direction: "previous" | "next") => void;
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
  onReset,
  onNavigationBoundaryReached,
  isFocused,
  focusedIndex,
  onFocusedIndexChange,
  onKeyDown,
  className,
  ref,
}: SeverityFilterGroupProps) {
  const isFilterActive = activeFilter.size > 0;
  const resetIndex = SEVERITY_ORDER.length;
  const lastFilterIndex = SEVERITY_ORDER.length - 1;
  const isResetFocused = !!isFocused && focusedIndex === resetIndex;

  const isReviewSeverity = (value: string): value is ReviewSeverity => value in SEVERITY_LABELS;

  const handleValueChange = (value: readonly string[]) => {
    onFilterChange(new Set(value.filter(isReviewSeverity)));
  };

  // Resetting unmounts the Reset button, so return the zone's focus to the last
  // severity chip (mirrors the keyboard path's resetAndReturnToLastFilter);
  // otherwise DOM focus drops to body while the focused index points at the
  // now-unmounted Reset button.
  const handleReset = (container: Element | null) => {
    const lastSeverity = SEVERITY_ORDER[lastFilterIndex];
    onFocusedIndexChange?.(lastFilterIndex);
    onReset?.();
    if (lastSeverity) {
      container?.querySelector<HTMLButtonElement>(`button[data-value="${lastSeverity}"]`)?.focus();
    }
  };

  const handleHighlightChange = (value: string | null) => {
    if (value === null) return;
    // biome-ignore lint/complexity/useIndexOf: SEVERITY_ORDER is a readonly ReviewSeverity tuple; indexOf(value:string) would require the cast F-202 removed.
    const index = SEVERITY_ORDER.findIndex((severity) => severity === value);
    if (index >= 0) onFocusedIndexChange?.(index);
  };

  const valueArray = Array.from(activeFilter);
  const highlightedSeverity = isFocused ? (SEVERITY_ORDER[focusedIndex ?? 0] ?? null) : null;

  return (
    <div
      ref={ref}
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", className)}
      data-severity-filter-row=""
    >
      <ToggleGroup
        selectionMode="multiple"
        value={valueArray}
        onChange={handleValueChange}
        onHighlightChange={handleHighlightChange}
        onNavigationBoundaryReached={(direction) => onNavigationBoundaryReached?.(direction)}
        highlighted={highlightedSeverity}
        onKeyDown={onKeyDown}
        label="Severity filter"
        className="flex-wrap gap-2 gap-y-1"
        wrap={false}
      >
        {SEVERITY_ORDER.map((sev) => {
          const count = counts[sev];
          const label = SEVERITY_LABELS[sev];
          const visibleLabel = formatSeverityFilterLabel(sev, count);
          const isActive = activeFilter.has(sev);
          return (
            <ToggleGroupItem
              key={sev}
              value={sev}
              aria-label={`${label} severity, ${pluralize(count, "issue")}`}
              className={cn(
                "min-w-fit px-1.5 text-xs inline-flex items-center whitespace-nowrap tabular-nums pointer-coarse:min-h-11 pointer-coarse:px-3",
                isActive && SEVERITY_CONFIG[sev].color,
              )}
            >
              <span aria-hidden="true">[{visibleLabel}]</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      {isFilterActive && (
        <Button
          variant="secondary"
          size="sm"
          data-diffgazer-navigation-item="button"
          data-value={RESET_FILTER_VALUE}
          tabIndex={isResetFocused ? 0 : -1}
          onClick={(event) =>
            handleReset(event.currentTarget.closest("[data-severity-filter-row]"))
          }
          onFocus={() => onFocusedIndexChange?.(resetIndex)}
          onKeyDown={onKeyDown}
          aria-label="Reset severity filter"
          highlighted={isResetFocused}
          className="min-w-fit px-1.5 text-xs pointer-coarse:min-h-11 pointer-coarse:px-3"
          bracket
        >
          Reset
        </Button>
      )}
    </div>
  );
}
