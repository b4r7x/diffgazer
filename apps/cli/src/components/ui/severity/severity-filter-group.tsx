import type { ReactElement } from "react";
import { Box } from "ink";
import type { TriageSeverity } from "@repo/schemas/triage";
import { type UISeverityFilter, SEVERITY_ORDER } from "@repo/schemas/ui";
import { SeverityFilterButton } from "./severity-filter-button.js";

export type SeverityFilter = UISeverityFilter;

export interface SeverityFilterGroupProps {
  counts: Record<TriageSeverity, number>;
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

