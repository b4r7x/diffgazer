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

export type SeverityChipMode = "full" | "wrapped" | "short";

export interface SeverityChipLayout {
  mode: SeverityChipMode;
  /** Rows the chip row occupies, so the list pane can budget its viewport. */
  rows: number;
}

export interface SeverityChipLayoutInput {
  labels: string[];
  hasReset: boolean;
  contentWidth: number;
}

/**
 * Readable chips are worth a second row: the row wraps before it collapses to
 * single letters, so the cryptic codes survive only where one whole chip cannot
 * fit on a line.
 */
export function getSeverityChipLayout({
  labels,
  hasReset,
  contentWidth,
}: SeverityChipLayoutInput): SeverityChipLayout {
  const chips = [...labels, ...(hasReset ? ["Reset"] : [])];
  const fullRowWidth = chips.reduce(
    (width, label, index) => width + label.length + 2 + (index > 0 ? 1 : 0),
    0,
  );
  if (fullRowWidth <= contentWidth) return { mode: "full", rows: 1 };

  const widestChip = Math.max(...chips.map((label) => label.length + 2));
  if (widestChip > contentWidth) return { mode: "short", rows: 1 };

  return { mode: "wrapped", rows: Math.ceil(fullRowWidth / Math.max(contentWidth, 1)) };
}

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
  const { mode } = getSeverityChipLayout({
    labels: fullLabels,
    hasReset: isFilterActive,
    contentWidth,
  });
  const useShortLabels = mode === "short";

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
    // columnGap, not gap: Ink's `gap` spends a row between wrapped chip rows,
    // and the wrapped layout above counts contiguous rows.
    <Box columnGap={1} width={contentWidth} flexWrap="wrap">
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
