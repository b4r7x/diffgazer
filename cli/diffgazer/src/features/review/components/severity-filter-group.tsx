import { formatSeverityFilterLabel, toggleSeverity } from "@diffgazer/core/review";
import {
  SEVERITY_ORDER,
  type SeverityCounts,
  type UISeverityFilter,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useTheme } from "../../../theme/provider";
import { severityColor } from "../../../theme/severity";

export interface SeverityFilterGroupProps {
  currentFilter: UISeverityFilter;
  onFilterChange: (filter: UISeverityFilter) => void;
  issueCounts: SeverityCounts;
  isActive: boolean;
  contentWidth: number;
}

const SHORT_SEVERITY_LABELS: Record<(typeof SEVERITY_ORDER)[number], string> = {
  blocker: "B",
  high: "H",
  medium: "M",
  low: "L",
  nit: "N",
};

export function SeverityFilterGroup({
  currentFilter,
  onFilterChange,
  issueCounts,
  isActive,
  contentWidth,
}: SeverityFilterGroupProps) {
  const { tokens } = useTheme();
  const isFilterActive = currentFilter.size > 0;
  const resetIndex = SEVERITY_ORDER.length;
  const maxIndex = isFilterActive ? resetIndex : SEVERITY_ORDER.length - 1;
  const [rawFocusedIndex, setFocusedIndex] = useState(0);
  // Derive the clamp instead of writing state during render: when the filter
  // becomes inactive the Reset chip disappears and maxIndex shrinks, so the
  // stored index is clamped for display until the next keyboard write.
  const focusedIndex = Math.min(rawFocusedIndex, maxIndex);
  const fullLabels = SEVERITY_ORDER.map((severity) =>
    formatSeverityFilterLabel(severity, issueCounts[severity]),
  );
  const resetLabel = isFilterActive ? "Reset" : null;
  const fullRowWidth = [...fullLabels, ...(resetLabel ? [resetLabel] : [])].reduce(
    (width, label, index) => width + label.length + 2 + (index > 0 ? 1 : 0),
    0,
  );
  const useShortLabels = fullRowWidth > contentWidth;

  useInput(
    (input, key) => {
      if (key.leftArrow) {
        setFocusedIndex(Math.max(0, focusedIndex - 1));
        return;
      }
      if (key.rightArrow) {
        setFocusedIndex(Math.min(maxIndex, focusedIndex + 1));
        return;
      }
      if (key.return || input === " ") {
        if (focusedIndex === resetIndex) {
          onFilterChange(new Set());
          setFocusedIndex(SEVERITY_ORDER.length - 1);
          return;
        }
        const severity = SEVERITY_ORDER[focusedIndex];
        if (severity) onFilterChange(toggleSeverity(currentFilter, severity));
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
    <Box gap={1} width={contentWidth} flexWrap="wrap">
      {SEVERITY_ORDER.map((severity, index) => {
        const isSelected = currentFilter.has(severity);
        const isFocused = isActive && index === focusedIndex;
        const count = issueCounts[severity];
        const label = useShortLabels
          ? `${SHORT_SEVERITY_LABELS[severity]}${String(count)}`
          : (fullLabels[index] ?? "");
        const color = severityColor(severity, tokens);

        return (
          <Box key={severity} flexShrink={0}>
            <Text color={isSelected ? color : tokens.muted} bold={isSelected} inverse={isFocused}>
              {useShortLabels ? label : `[${label}]`}
            </Text>
          </Box>
        );
      })}
      {isFilterActive && (
        <Box flexShrink={0}>
          <Text color={tokens.accent} bold inverse={isActive && focusedIndex === resetIndex}>
            {useShortLabels ? "R" : "[Reset]"}
          </Text>
        </Box>
      )}
    </Box>
  );
}
