import { cn } from "@/lib/utils";
import type { ReviewSeverity } from "@stargazer/schemas/review";
import { type UISeverityFilter, SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { SeverityFilterButton } from "./severity-filter-button";

export type SeverityFilter = UISeverityFilter;

export interface SeverityFilterGroupProps {
  counts: Record<ReviewSeverity, number>;
  activeFilter: SeverityFilter;
  onFilterChange: (filter: SeverityFilter) => void;
  isFocused?: boolean;
  focusedIndex?: number;
  className?: string;
}

export function SeverityFilterGroup({
  counts,
  activeFilter,
  onFilterChange,
  isFocused,
  focusedIndex,
  className,
}: SeverityFilterGroupProps) {
  return (
    <div className={cn("flex gap-2 text-xs flex-wrap", className)}>
      {SEVERITY_ORDER.map((sev, index) => (
        <SeverityFilterButton
          key={sev}
          severity={sev}
          count={counts[sev]}
          isActive={activeFilter === sev}
          isFocused={isFocused && focusedIndex === index}
          onClick={() => onFilterChange(activeFilter === sev ? "all" : sev)}
        />
      ))}
    </div>
  );
}
