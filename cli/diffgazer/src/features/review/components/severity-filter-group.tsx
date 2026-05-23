import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import {
  type UISeverityFilter,
  type SeverityCounts,
  SEVERITY_ORDER,
  SEVERITY_LABELS,
} from "@diffgazer/core/schemas/presentation";
import { useTheme } from "../../../theme/theme-context.js";
import { severityColor } from "../../../theme/severity.js";

export interface SeverityFilterGroupProps {
  currentFilter: UISeverityFilter;
  onFilterChange: (filter: UISeverityFilter) => void;
  issueCounts: SeverityCounts;
  isActive: boolean;
}

export function SeverityFilterGroup({
  currentFilter,
  onFilterChange,
  issueCounts,
  isActive,
}: SeverityFilterGroupProps) {
  const { tokens } = useTheme();
  const isFilterActive = currentFilter.size > 0;
  const resetIndex = SEVERITY_ORDER.length;
  const maxIndex = isFilterActive ? resetIndex : SEVERITY_ORDER.length - 1;
  const [focusedIndex, setFocusedIndex] = useState(0);

  if (focusedIndex > maxIndex) {
    setFocusedIndex(maxIndex);
  }

  const toggleSeverity = (severity: ReviewSeverity) => {
    const next = new Set(currentFilter);
    if (next.has(severity)) next.delete(severity);
    else next.add(severity);
    onFilterChange(next);
  };

  useInput(
    (input, key) => {
      if (key.leftArrow) {
        setFocusedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.rightArrow) {
        setFocusedIndex((prev) => Math.min(maxIndex, prev + 1));
        return;
      }
      if (key.return || input === " ") {
        if (focusedIndex === resetIndex) {
          onFilterChange(new Set());
          setFocusedIndex(SEVERITY_ORDER.length - 1);
          return;
        }
        const severity = SEVERITY_ORDER[focusedIndex];
        if (severity) toggleSeverity(severity);
        return;
      }
      if (input === "r" && isFilterActive) {
        onFilterChange(new Set());
        setFocusedIndex(SEVERITY_ORDER.length - 1);
      }
    },
    { isActive },
  );

  return (
    <Box gap={1}>
      {SEVERITY_ORDER.map((severity, index) => {
        const isSelected = currentFilter.has(severity);
        const isFocused = isActive && index === focusedIndex;
        const count = issueCounts[severity];
        const label = `${SEVERITY_LABELS[severity]} (${count})`;
        const color = severityColor(severity, tokens);

        return (
          <Text
            key={severity}
            color={isSelected ? color : tokens.muted}
            bold={isSelected}
            inverse={isFocused}
          >
            [{label}]
          </Text>
        );
      })}
      {isFilterActive && (
        <Text
          color={tokens.accent}
          bold
          inverse={isActive && focusedIndex === resetIndex}
        >
          [Reset]
        </Text>
      )}
    </Box>
  );
}
