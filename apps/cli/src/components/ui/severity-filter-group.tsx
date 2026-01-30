import type { ReactElement } from "react";
import { Box } from "ink";
import { SeverityFilterButton, type SeverityLevel } from "./severity-filter-button.js";

export type SeverityFilter = SeverityLevel | "all";

const SEVERITY_ORDER: readonly SeverityLevel[] = ["blocker", "high", "medium", "low", "nit"];

export interface SeverityFilterGroupProps {
  counts: Record<SeverityLevel, number>;
  activeFilter: SeverityFilter;
  isFocused?: boolean;
  focusedIndex?: number;
  onFilterChange?: (filter: SeverityFilter) => void;
}

export function SeverityFilterGroup({
  counts,
  activeFilter,
  isFocused = false,
  focusedIndex = 0,
  onFilterChange,
}: SeverityFilterGroupProps): ReactElement {
  return (
    <Box gap={1} flexWrap="wrap">
      {SEVERITY_ORDER.map((sev, index) => (
        <SeverityFilterButton
          key={sev}
          severity={sev}
          count={counts[sev]}
          isActive={activeFilter === sev}
          isFocused={isFocused && focusedIndex === index}
          onClick={onFilterChange ? () => onFilterChange(sev) : undefined}
        />
      ))}
    </Box>
  );
}

export { SEVERITY_ORDER };
