import { cn } from "@diffgazer/core/cn";
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
  className?: string;
}

export function SeverityFilterGroup({
  counts,
  activeFilter,
  onFilterChange,
  isFocused,
  focusedIndex,
  onFocusedIndexChange,
  className,
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
      value={activeFilter === "all" ? null : activeFilter}
      allowDeselect
      onChange={handleFilterChange}
      onHighlightChange={(value) => {
        const index = SEVERITY_ORDER.findIndex((severity) => severity === value);
        if (index >= 0) onFocusedIndexChange?.(index);
      }}
      highlighted={isFocused ? SEVERITY_ORDER[focusedIndex ?? 0] ?? null : null}
      label="Severity filter"
      className={cn("text-xs", className)}
    >
      {SEVERITY_ORDER.map((sev, index) => (
        <ToggleGroupItem
          key={sev}
          value={sev}
          count={counts[sev]}
          className={cn(
            "min-h-0 min-w-0 px-1.5 py-0 text-xs",
            activeFilter === sev && SEVERITY_CONFIG[sev].color,
            isFocused && focusedIndex === index && "ring-1 ring-tui-blue",
          )}
        >
          {SEVERITY_CONFIG[sev].label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
