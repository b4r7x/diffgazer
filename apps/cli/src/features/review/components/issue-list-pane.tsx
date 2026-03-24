import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import {
  type UISeverityFilter,
  SEVERITY_ORDER,
  calculateSeverityCounts,
  SEVERITY_LABELS,
} from "@diffgazer/schemas/ui";
import { useTheme } from "../../../theme/theme-context.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { IssuePreviewItem } from "./issue-preview-item.js";

const FILTER_OPTIONS: UISeverityFilter[] = [
  "all",
  ...SEVERITY_ORDER,
];

export interface IssueListPaneProps {
  issues: ReviewIssue[];
  allIssues: ReviewIssue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  height?: number;
  severityFilter: UISeverityFilter;
  onSeverityFilterChange: (filter: UISeverityFilter) => void;
}

export function IssueListPane({
  issues,
  allIssues,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = false,
  height = 15,
  severityFilter,
  onSeverityFilterChange,
}: IssueListPaneProps) {
  const { tokens } = useTheme();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const counts = calculateSeverityCounts(allIssues);

  useInput(
    (input, key) => {
      // f cycles severity filter forward
      if (input === "f") {
        const currentIdx = FILTER_OPTIONS.indexOf(severityFilter);
        const nextIdx = (currentIdx + 1) % FILTER_OPTIONS.length;
        const next = FILTER_OPTIONS[nextIdx];
        if (next !== undefined) {
          onSeverityFilterChange(next);
        }
        return;
      }

      if (issues.length === 0) return;

      if (key.downArrow || input === "j") {
        const nextIndex = Math.min(highlightedIndex + 1, issues.length - 1);
        setHighlightedIndex(nextIndex);
        const issue = issues[nextIndex];
        if (issue) {
          onHighlightChange?.(issue.id);
        }
        return;
      }

      if (key.upArrow || input === "k") {
        const nextIndex = Math.max(highlightedIndex - 1, 0);
        setHighlightedIndex(nextIndex);
        const issue = issues[nextIndex];
        if (issue) {
          onHighlightChange?.(issue.id);
        }
        return;
      }

      if (key.return) {
        const issue = issues[highlightedIndex];
        if (issue) {
          onSelect?.(issue.id);
        }
        return;
      }
    },
    { isActive },
  );

  const filterLabel = severityFilter === "all"
    ? `ALL (${allIssues.length})`
    : `${SEVERITY_LABELS[severityFilter]} (${counts[severityFilter]})`;

  if (issues.length === 0) {
    return (
      <Box flexDirection="column">
        <SectionHeader>Issues</SectionHeader>
        <Box marginBottom={1} gap={1}>
          <Text color={tokens.muted}>Filter:</Text>
          <Text color={tokens.accent} bold>{filterLabel}</Text>
          <Text color={tokens.muted} dimColor>[f]</Text>
        </Box>
        <Text color={tokens.muted}>No issues match filter</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <SectionHeader bordered>
        {`Issues (${issues.length})`}
      </SectionHeader>
      <Box marginBottom={1} gap={1}>
        <Text color={tokens.muted}>Filter:</Text>
        <Text color={tokens.accent} bold>{filterLabel}</Text>
        <Text color={tokens.muted} dimColor>[f]</Text>
      </Box>
      <ScrollArea height={height} isActive={false}>
        {issues.map((issue, index) => (
          <Box key={issue.id}>
            <Text color={selectedId === issue.id ? tokens.accent : tokens.muted}>
              {selectedId === issue.id ? "\u2502 " : "  "}
            </Text>
            <IssuePreviewItem
              severity={issue.severity}
              filePath={issue.file}
              title={issue.title}
              isHighlighted={index === highlightedIndex}
            />
          </Box>
        ))}
      </ScrollArea>
    </Box>
  );
}
