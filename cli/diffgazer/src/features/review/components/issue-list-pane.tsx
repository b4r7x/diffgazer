import { formatSeverityFilterLabel } from "@diffgazer/core/review";
import {
  calculateSeverityCounts,
  SEVERITY_ORDER,
  type UISeverityFilter,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { clampIndex } from "@diffgazer/keys";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { SectionHeader } from "../../../components/ui/section-header";
import { getListWindow } from "../../../lib/list-window";
import { selectionHue } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { getSeverityChipLayout } from "../lib/severity-chip-layout";
import { IssuePreviewItem } from "./issue-preview-item";
import { SeverityFilterGroup } from "./severity-filter-group";

export type IssueListSubZone = "filter" | "issues";

export interface IssueListPaneProps {
  issues: ReviewIssue[];
  allIssues: ReviewIssue[];
  selectedId?: string;
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
  const [internalSubZone, setInternalSubZone] = useState<IssueListSubZone>("issues");
  const subZone = externalSubZone ?? internalSubZone;
  const effectiveSubZone = issues.length === 0 ? "filter" : subZone;
  const setSubZone = onSubZoneChange ?? setInternalSubZone;
  const counts = calculateSeverityCounts(allIssues);
  // The selected id is the only cursor: a second positional one would drift
  // apart from it on a deep link or a filter change.
  const highlightedIndex = Math.max(
    0,
    issues.findIndex((issue) => issue.id === selectedId),
  );

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
        const nextIssue = issues[clampIndex(highlightedIndex, 1, issues.length, false)];
        if (nextIssue) {
          onHighlightChange?.(nextIssue.id);
        }
        return;
      }

      if (key.upArrow || input === "k") {
        if (highlightedIndex === 0) {
          setSubZone("filter");
          return;
        }
        const previousIssue = issues[highlightedIndex - 1];
        if (previousIssue) {
          onHighlightChange?.(previousIssue.id);
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
            contentWidth={contentWidth}
          />
        </Box>
        <Text color={tokens.muted}>No issues match filter</Text>
      </Box>
    );
  }

  // A wrapped chip row costs the list one viewport row per extra chip line.
  const chipRows = getSeverityChipLayout({
    labels: SEVERITY_ORDER.map((severity) => formatSeverityFilterLabel(severity, counts[severity])),
    hasReset: severityFilter.size > 0,
    contentWidth,
  }).rows;
  const window = getListWindow({
    selectedIndex: highlightedIndex,
    total: issues.length,
    viewportRows: Math.max(height - (chipRows - 1), 1),
  });
  const visibleIssues = issues.slice(window.start, window.end);

  return (
    <Box flexDirection="column">
      <SectionHeader bordered>{`Issues (${issues.length})`}</SectionHeader>
      <Box marginBottom={1}>
        <SeverityFilterGroup
          currentFilter={severityFilter}
          onFilterChange={onSeverityFilterChange}
          issueCounts={counts}
          isActive={isActive && effectiveSubZone === "filter"}
          contentWidth={contentWidth}
        />
      </Box>
      <Box flexDirection="column">
        {window.canScrollUp ? <Text color={tokens.muted}>{"\u25b2"}</Text> : null}
        <Box flexDirection="column" height={window.end - window.start} overflow="hidden">
          {visibleIssues.map((issue, idx) => {
            const absoluteIndex = window.start + idx;
            return (
              <Box key={issue.id}>
                <Text color={selectedId === issue.id ? selectionHue(tokens) : tokens.muted}>
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
        {window.canScrollDown ? <Text color={tokens.muted}>{"\u25bc"}</Text> : null}
      </Box>
    </Box>
  );
}
