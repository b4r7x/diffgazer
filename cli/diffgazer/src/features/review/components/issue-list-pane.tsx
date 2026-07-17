import {
  calculateSeverityCounts,
  type UISeverityFilter,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { SectionHeader } from "../../../components/ui/section-header";
import { getVisibleSliceOffset } from "../../../lib/visible-slice-offset";
import { useTheme } from "../../../theme/provider";
import { IssuePreviewItem } from "./issue-preview-item";
import { SeverityFilterGroup } from "./severity-filter-group";

export type IssueListSubZone = "filter" | "issues";

export interface IssueListPaneProps {
  issues: ReviewIssue[];
  allIssues: ReviewIssue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  height?: number;
  contentWidth: number;
  severityFilter: UISeverityFilter;
  onSeverityFilterChange: (filter: UISeverityFilter) => void;
  subZone?: IssueListSubZone;
  onSubZoneChange?: (zone: IssueListSubZone) => void;
}

export function IssueListPane({
  issues,
  allIssues,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = false,
  height = 15,
  contentWidth,
  severityFilter,
  onSeverityFilterChange,
  subZone: externalSubZone,
  onSubZoneChange,
}: IssueListPaneProps) {
  const { tokens } = useTheme();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [trackedIssueCount, setTrackedIssueCount] = useState(issues.length);
  const [internalSubZone, setInternalSubZone] = useState<IssueListSubZone>("issues");
  const subZone = externalSubZone ?? internalSubZone;
  const effectiveSubZone = issues.length === 0 ? "filter" : subZone;
  const setSubZone = onSubZoneChange ?? setInternalSubZone;
  const counts = calculateSeverityCounts(allIssues);

  if (issues.length !== trackedIssueCount) {
    setTrackedIssueCount(issues.length);
    setHighlightedIndex(0);
  }

  useInput(
    (input, key) => {
      if (effectiveSubZone === "filter") {
        if (key.downArrow && issues.length > 0) {
          setSubZone("issues");
        }
        // Left/right/enter/space handled by SeverityFilterGroup.
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
            isActive={isActive && effectiveSubZone === "filter"}
          />
        </Box>
        <Text color={tokens.muted}>No issues match filter</Text>
      </Box>
    );
  }

  const sliceOffset = getVisibleSliceOffset(highlightedIndex, issues.length, height);
  const visibleIssues = issues.slice(sliceOffset, sliceOffset + height);
  const canScrollUp = sliceOffset > 0;
  const canScrollDown = sliceOffset + height < issues.length;

  return (
    <Box flexDirection="column">
      <SectionHeader bordered>{`Issues (${issues.length})`}</SectionHeader>
      <Box marginBottom={1}>
        <SeverityFilterGroup
          currentFilter={severityFilter}
          onFilterChange={onSeverityFilterChange}
          issueCounts={counts}
          isActive={isActive && effectiveSubZone === "filter"}
        />
      </Box>
      <Box flexDirection="column">
        {canScrollUp ? <Text color={tokens.muted}>{"\u25b2"}</Text> : null}
        <Box flexDirection="column" height={height} overflow="hidden">
          {visibleIssues.map((issue, idx) => {
            const absoluteIndex = sliceOffset + idx;
            return (
              <Box key={issue.id}>
                <Text color={selectedId === issue.id ? tokens.accent : tokens.muted}>
                  {selectedId === issue.id ? "\u2502 " : "  "}
                </Text>
                <IssuePreviewItem
                  severity={issue.severity}
                  filePath={issue.file}
                  title={issue.title}
                  contentWidth={contentWidth}
                  isHighlighted={
                    isActive && effectiveSubZone === "issues" && absoluteIndex === highlightedIndex
                  }
                />
              </Box>
            );
          })}
        </Box>
        {canScrollDown ? <Text color={tokens.muted}>{"\u25bc"}</Text> : null}
      </Box>
    </Box>
  );
}
