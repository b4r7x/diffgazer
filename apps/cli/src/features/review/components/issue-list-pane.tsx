import { useState, useEffect, type ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import { SeverityBadge } from "../../../components/ui/badge.js";
import { useTheme } from "../../../hooks/use-theme.js";

interface IssueListPaneProps {
  issues: TriageIssue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  focus: boolean;
  height: number;
}

interface SeverityCounts {
  blocker: number;
  high: number;
  medium: number;
  low: number;
  nit: number;
}

function countSeverities(issues: TriageIssue[]): SeverityCounts {
  const counts: SeverityCounts = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}

function formatSeverityCounts(counts: SeverityCounts): string {
  const parts: string[] = [];
  if (counts.blocker > 0) parts.push(`${counts.blocker} blocker`);
  if (counts.high > 0) parts.push(`${counts.high} high`);
  if (counts.medium > 0) parts.push(`${counts.medium} medium`);
  if (counts.low > 0) parts.push(`${counts.low} low`);
  if (counts.nit > 0) parts.push(`${counts.nit} nit`);
  return parts.join(", ");
}

function IssueListHeader({
  count,
  severityCounts,
}: {
  count: number;
  severityCounts: SeverityCounts;
}): ReactElement {
  const countsStr = formatSeverityCounts(severityCounts);

  return (
    <Box marginBottom={1}>
      <Text bold>
        {count} issue{count !== 1 ? "s" : ""}
      </Text>
      {countsStr && (
        <Text dimColor> ({countsStr})</Text>
      )}
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
  selectedId,
  onSelect,
  focus,
  height,
}: IssueListPaneProps): ReactElement {
  const { colors } = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);

  const headerHeight = 2;
  const borderHeight = 2;
  const scrollIndicatorHeight = 1;
  const availableHeight = Math.max(1, height - headerHeight - borderHeight);

  const selectedIndex = selectedId
    ? issues.findIndex((issue) => issue.id === selectedId)
    : -1;

  const severityCounts = countSeverities(issues);

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
      <IssueListHeader count={issues.length} severityCounts={severityCounts} />

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
