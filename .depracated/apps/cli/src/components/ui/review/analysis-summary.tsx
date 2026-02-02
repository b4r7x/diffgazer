import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../hooks/use-theme.js";
import { Card } from "../layout/index.js";
import { SeverityBreakdown } from "../severity/index.js";
import { IssuePreviewItem } from "../issue/index.js";
import { LensStatsTable, type LensStats } from "./lens-stats-table.js";
import { SectionHeader } from "../section-header.js";
import type { AnalysisStats, SeverityCounts, IssuePreview } from "@repo/schemas/ui";

export type { AnalysisStats, SeverityCounts, IssuePreview };

export interface AnalysisSummaryProps {
  stats: AnalysisStats;
  severityCounts: SeverityCounts;
  lensStats: LensStats[];
  topIssues: IssuePreview[];
  selectedIssueIndex?: number;
}

export function AnalysisSummary({
  stats,
  severityCounts,
  lensStats,
  topIssues,
  selectedIssueIndex,
}: AnalysisSummaryProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column" gap={1}>
      <Box
        borderStyle="single"
        borderLeft
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        borderColor={colors.ui.success}
        paddingLeft={2}
        flexDirection="column"
      >
        <Text color={colors.ui.success} bold>
          Analysis Complete #{stats.runId}
        </Text>
        <Box>
          <Text color={colors.ui.textMuted}>Found </Text>
          <Text color={colors.ui.text} bold>
            {stats.totalIssues} issues
          </Text>
          <Text color={colors.ui.textMuted}> across </Text>
          <Text color={colors.ui.text} bold>
            {stats.filesAnalyzed} files
          </Text>
          <Text color={colors.ui.textMuted}>.</Text>
          {stats.criticalCount > 0 && (
            <>
              <Text color={colors.ui.textMuted}> Security lens flagged </Text>
              <Text color={colors.ui.error} bold>
                {stats.criticalCount} critical blockers
              </Text>
              <Text color={colors.ui.textMuted}>.</Text>
            </>
          )}
        </Box>
      </Box>

      <Box gap={2}>
        <SeverityBreakdown counts={severityCounts} />

        <Card title="Issues by Lens" width="50%">
          <LensStatsTable lenses={lensStats} />
        </Card>
      </Box>

      {topIssues.length > 0 && (
        <Box flexDirection="column">
          <SectionHeader>Top Issues Preview</SectionHeader>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={colors.ui.border}
          >
            {topIssues.map((issue, index) => (
              <IssuePreviewItem
                key={issue.id}
                title={issue.title}
                file={issue.file}
                line={issue.line}
                category={issue.category}
                severity={issue.severity}
                isSelected={selectedIssueIndex === index}
              />
            ))}
          </Box>
        </Box>
      )}

      <Box justifyContent="center" gap={2} marginTop={1}>
        <Text color={colors.ui.accent}>[E] Enter Review</Text>
        <Text color={colors.ui.textMuted}>[X] Export</Text>
        <Text color={colors.ui.textMuted}>[B] Back</Text>
      </Box>
    </Box>
  );
}
