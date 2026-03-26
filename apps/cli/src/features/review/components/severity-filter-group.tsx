import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ReviewSeverity } from "@diffgazer/schemas/review";
import {
  type UISeverityFilter,
  type SeverityCounts,
  SEVERITY_ORDER,
  SEVERITY_LABELS,
} from "@diffgazer/schemas/ui";
import { useTheme } from "../../../theme/theme-context.js";
import { severityColor } from "../../../theme/severity.js";

export interface SeverityFilterGroupProps {
  currentFilter: UISeverityFilter;
  onFilterChange: (filter: UISeverityFilter) => void;
  issueCounts: SeverityCounts;
  isActive: boolean;
}

type FilterOption = UISeverityFilter;

const FILTER_OPTIONS: FilterOption[] = ["all", ...SEVERITY_ORDER];

function filterLabel(option: FilterOption): string {
  return option === "all" ? "All" : SEVERITY_LABELS[option];
}

function filterCount(
  option: FilterOption,
  counts: SeverityCounts,
): number {
  if (option === "all") {
    return counts.blocker + counts.high + counts.medium + counts.low + counts.nit;
  }
  return counts[option];
}

export function SeverityFilterGroup({
  currentFilter,
  onFilterChange,
  issueCounts,
  isActive,
}: SeverityFilterGroupProps) {
  const { tokens } = useTheme();
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(0, FILTER_OPTIONS.indexOf(currentFilter)),
  );

  useInput(
    (_input, key) => {
      if (key.leftArrow) {
        setFocusedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.rightArrow) {
        setFocusedIndex((prev) =>
          Math.min(FILTER_OPTIONS.length - 1, prev + 1),
        );
        return;
      }
      if (key.return || _input === " ") {
        const option = FILTER_OPTIONS[focusedIndex];
        if (option !== undefined) {
          onFilterChange(option === currentFilter ? "all" : option);
        }
      }
    },
    { isActive },
  );

  return (
    <Box gap={1}>
      {FILTER_OPTIONS.map((option, index) => {
        const isSelected = option === currentFilter;
        const isFocused = isActive && index === focusedIndex;
        const count = filterCount(option, issueCounts);
        const label = `${filterLabel(option)} (${count})`;

        if (option === "all") {
          return (
            <Text
              key={option}
              color={isSelected ? tokens.accent : tokens.muted}
              bold={isSelected}
              inverse={isFocused}
            >
              [{label}]
            </Text>
          );
        }

        const color = severityColor(option, tokens);
        return (
          <Text
            key={option}
            color={isSelected ? color : tokens.muted}
            bold={isSelected}
            inverse={isFocused}
          >
            [{label}]
          </Text>
        );
      })}
    </Box>
  );
}
