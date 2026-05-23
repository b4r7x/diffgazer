import { cn } from "@diffgazer/ui/lib/utils";
import { useEffect, useRef, type KeyboardEvent, type Ref } from "react";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";

export type SeverityFilter = ReadonlySet<ReviewSeverity>;

export const RESET_FILTER_VALUE = "__reset__";

export interface SeverityFilterGroupProps {
  counts: Record<ReviewSeverity, number>;
  activeFilter: SeverityFilter;
  onFilterChange: (filter: SeverityFilter) => void;
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
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const isFilterActive = activeFilter.size > 0;
  const resetIndex = SEVERITY_ORDER.length;
  const isResetFocused = !!isFocused && focusedIndex === resetIndex;

  useEffect(() => {
    if (!isResetFocused) return;
    const button = resetButtonRef.current;
    if (!button) return;
    if (button === button.ownerDocument.activeElement) return;
    button.focus();
  }, [isResetFocused]);

  const handleValueChange = (value: readonly string[]) => {
    onFilterChange(new Set(value as readonly ReviewSeverity[]));
  };

  const handleHighlightChange = (value: string | null) => {
    if (value === null) return;
    const index = SEVERITY_ORDER.findIndex((s) => s === value);
    if (index >= 0) onFocusedIndexChange?.(index);
  };

  const valueArray = Array.from(activeFilter);
  const highlightedSeverity = isFocused
    ? SEVERITY_ORDER[focusedIndex ?? 0] ?? null
    : null;

  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 text-xs", className)}
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
        className="gap-2"
        wrap={false}
      >
        {SEVERITY_ORDER.map((sev, index) => {
          const count = counts[sev];
          const label = SEVERITY_CONFIG[sev].label;
          const isActive = activeFilter.has(sev);
          return (
            <ToggleGroupItem
              key={sev}
              value={sev}
              aria-label={`${label} severity, ${count} ${count === 1 ? "issue" : "issues"}, ${isActive ? "selected" : "not selected"}`}
              className={cn(
                "h-5 min-h-0 min-w-fit px-1.5 text-[11px] inline-flex items-center whitespace-nowrap tabular-nums focus-visible:ring-0 focus-visible:outline-none",
                isActive && SEVERITY_CONFIG[sev].color,
                isFocused && focusedIndex === index && "border-tui-blue bg-tui-selection",
              )}
            >
              <span aria-hidden="true">[{label} {count}]</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      {isFilterActive && (
        <button
          ref={resetButtonRef}
          type="button"
          data-diffgazer-navigation-item="button"
          data-value={RESET_FILTER_VALUE}
          tabIndex={isResetFocused ? 0 : -1}
          onClick={() => {
            onFocusedIndexChange?.(resetIndex);
            onReset?.();
          }}
          onFocus={() => onFocusedIndexChange?.(resetIndex)}
          onKeyDown={onKeyDown}
          aria-label="Reset severity filter"
          className={cn(
            "h-5 min-h-0 min-w-fit px-1.5 text-[11px] inline-flex items-center whitespace-nowrap font-mono border border-border bg-transparent text-foreground hover:bg-secondary cursor-pointer focus-visible:ring-0 focus-visible:outline-none",
            isResetFocused && "border-tui-blue bg-tui-selection",
          )}
        >
          [Reset]
        </button>
      )}
    </div>
  );
}
