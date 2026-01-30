import { useState, useEffect, type ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import { SeverityBadge } from "../../../components/ui/badge.js";
import { SeverityFilterGroup, type SeverityFilter } from "../../../components/ui/severity-filter-group.js";
import type { SeverityLevel } from "../../../components/ui/severity-filter-button.js";
import { useTheme } from "../../../hooks/use-theme.js";

interface IssueListPaneProps {
  issues: TriageIssue[];
  allIssues?: TriageIssue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  focus: boolean;
  height: number;
  title?: string;
  severityFilter?: SeverityFilter;
  onSeverityFilterChange?: (filter: SeverityFilter) => void;
  isFilterFocused?: boolean;
  focusedFilterIndex?: number;
}


function IssueListHeader({
  title,
  count,
}: {
  title?: string;
  count: number;
}): ReactElement {
  const { colors } = useTheme();

  return (
    <Box marginBottom={1} flexDirection="column">
      {title && (
        <Text bold color={colors.ui.accent}>
          {title}
        </Text>
      )}
      <Text dimColor>
        {count} issue{count !== 1 ? "s" : ""}
      </Text>
    </Box>
  );
}

function IssueListItem({
  issue,
  isSelected,
  isFocused,
}: {
  issue: TriageIssue;
  isSelected: boolean;
  isFocused: boolean;
}): ReactElement {
  const { colors } = useTheme();
  const prefix = isSelected ? ">" : " ";
  const location = issue.line_start ? `${issue.file}:${issue.line_start}` : issue.file;

  const textColor = isSelected && isFocused ? colors.ui.accent : undefined;
  const isBold = isSelected && isFocused;
  const isDimmed = !isFocused;

  return (
    <Box flexDirection="row" paddingX={1}>
      <Text
        color={isSelected && isFocused ? colors.ui.accent : undefined}
        bold={isSelected && isFocused}
        dimColor={isDimmed && !isSelected}
      >
        {prefix}{" "}
      </Text>
      <SeverityBadge severity={issue.severity} />
      <Text> </Text>
      <Box flexGrow={1} flexShrink={1}>
        <Text
          color={textColor}
          bold={isBold}
          dimColor={isDimmed && !isSelected}
          wrap="truncate"
        >
          {issue.title}
        </Text>
      </Box>
      <Text dimColor> {location}</Text>
    </Box>
  );
}

function calculateVisibleWindow(
  totalItems: number,
  selectedIndex: number,
  visibleCount: number,
  currentOffset: number
): { scrollOffset: number; endIndex: number } {
  if (totalItems <= visibleCount) {
    return { scrollOffset: 0, endIndex: totalItems };
  }

  let scrollOffset = currentOffset;

  if (selectedIndex >= 0) {
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
    } else if (selectedIndex >= scrollOffset + visibleCount) {
      scrollOffset = selectedIndex - visibleCount + 1;
    }
  }

  scrollOffset = Math.max(0, Math.min(scrollOffset, totalItems - visibleCount));

  return {
    scrollOffset,
    endIndex: Math.min(scrollOffset + visibleCount, totalItems),
  };
}

export function IssueListPane({
  issues,
  allIssues,
  selectedId,
  onSelect,
  focus,
  height,
  title,
  severityFilter,
  onSeverityFilterChange,
  isFilterFocused = false,
  focusedFilterIndex = 0,
}: IssueListPaneProps): ReactElement {
  const { colors } = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Use allIssues for severity counts if provided, otherwise use filtered issues
  const issuesForCounts = allIssues ?? issues;
  const severityCounts: Record<SeverityLevel, number> = {
    blocker: issuesForCounts.filter((i) => i.severity === "blocker").length,
    high: issuesForCounts.filter((i) => i.severity === "high").length,
    medium: issuesForCounts.filter((i) => i.severity === "medium").length,
    low: issuesForCounts.filter((i) => i.severity === "low").length,
    nit: issuesForCounts.filter((i) => i.severity === "nit").length,
  };

  const showFilters = severityFilter !== undefined && onSeverityFilterChange !== undefined;
  const headerHeight = title ? 3 : 2;
  const filterHeight = showFilters ? 2 : 0;
  const borderHeight = 2;
  const scrollIndicatorHeight = 1;
  const availableHeight = Math.max(1, height - headerHeight - filterHeight - borderHeight);

  const selectedIndex = selectedId
    ? issues.findIndex((issue) => issue.id === selectedId)
    : -1;

  const hasScrollIndicators = issues.length > availableHeight;
  const effectiveVisibleCount = hasScrollIndicators
    ? Math.max(1, availableHeight - scrollIndicatorHeight * 2)
    : availableHeight;

  const window = calculateVisibleWindow(
    issues.length,
    selectedIndex,
    effectiveVisibleCount,
    scrollOffset
  );

  useEffect(() => {
    if (window.scrollOffset !== scrollOffset) {
      setScrollOffset(window.scrollOffset);
    }
  }, [window.scrollOffset, scrollOffset]);

  const visibleIssues = issues.slice(window.scrollOffset, window.endIndex);
  const borderColor = focus ? colors.ui.borderFocused : colors.ui.border;

  const hasScrollUp = window.scrollOffset > 0;
  const hasScrollDown = window.endIndex < issues.length;

  return (
    <Box flexDirection="column" height={height}>
      <IssueListHeader title={title} count={issues.length} />

      {showFilters && (
        <Box marginBottom={1}>
          <SeverityFilterGroup
            counts={severityCounts}
            activeFilter={severityFilter}
            isFocused={isFilterFocused}
            focusedIndex={focusedFilterIndex}
            onFilterChange={onSeverityFilterChange}
          />
        </Box>
      )}

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={borderColor}
        flexGrow={1}
        overflow="hidden"
      >
        {hasScrollUp && (
          <Box justifyContent="center">
            <Text dimColor>--- {window.scrollOffset} more above ---</Text>
          </Box>
        )}

        {issues.length === 0 ? (
          <Box padding={1}>
            <Text dimColor>No issues found</Text>
          </Box>
        ) : (
          visibleIssues.map((issue) => (
            <IssueListItem
              key={issue.id}
              issue={issue}
              isSelected={issue.id === selectedId}
              isFocused={focus}
            />
          ))
        )}

        {hasScrollDown && (
          <Box justifyContent="center">
            <Text dimColor>--- {issues.length - window.endIndex} more below ---</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export { type IssueListPaneProps };
