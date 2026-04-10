import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import {
  type UISeverityFilter,
  calculateSeverityCounts,
} from "@diffgazer/schemas/ui";
import { useTheme } from "../../../theme/theme-context.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { IssuePreviewItem } from "./issue-preview-item.js";
import { SeverityFilterGroup } from "./severity-filter-group.js";

type SubZone = "filter" | "issues";

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
  const [subZone, setSubZone] = useState<SubZone>("issues");
  const counts = calculateSeverityCounts(allIssues);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [issues.length]);

  useInput(
    (input, key) => {
      if (subZone === "filter") {
        // Down arrow or j moves focus from filter to issue list
        if (key.downArrow || input === "j") {
          setSubZone("issues");
        }
        // Left/right/enter/space handled by SeverityFilterGroup
        return;
      }

      // subZone === "issues"
      if (issues.length === 0) {
        // Allow navigating up to filter even with no issues
        if (key.upArrow || input === "k") {
          setSubZone("filter");
        }
        return;
      }

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
        if (highlightedIndex === 0) {
          setSubZone("filter");
          return;
        }
        const nextIndex = highlightedIndex - 1;
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

  if (issues.length === 0) {
    return (
      <Box flexDirection="column">
        <SectionHeader>Issues</SectionHeader>
        <Box marginBottom={1}>
          <SeverityFilterGroup
            currentFilter={severityFilter}
            onFilterChange={onSeverityFilterChange}
            issueCounts={counts}
            isActive={isActive && subZone === "filter"}
          />
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
      <Box marginBottom={1}>
        <SeverityFilterGroup
          currentFilter={severityFilter}
          onFilterChange={onSeverityFilterChange}
          issueCounts={counts}
          isActive={isActive && subZone === "filter"}
        />
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
              isHighlighted={isActive && subZone === "issues" && index === highlightedIndex}
            />
          </Box>
        ))}
      </ScrollArea>
    </Box>
  );
}
