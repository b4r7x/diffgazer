import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import { Card } from "./card.js";
import { SeverityBar, type SeverityLevel } from "./severity-bar.js";
import { IssuePreviewItem } from "./issue-preview-item.js";
import { LensStatsTable, type LensStats } from "./lens-stats-table.js";
import { SectionHeader } from "./section-header.js";

export interface AnalysisStats {
  runId: string;
  totalIssues: number;
  filesAnalyzed: number;
  criticalCount: number;
}

export interface SeverityCounts {
  blocker: number;
  high: number;
  medium: number;
  low: number;
  nit: number;
}

export interface IssuePreview {
  id: string;
  title: string;
  file: string;
  line: number;
  category: string;
  severity: SeverityLevel;
}

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

  const maxCount = Math.max(
    severityCounts.blocker,
    severityCounts.high,
    severityCounts.medium,
    severityCounts.low,
    severityCounts.nit,
    1
  );

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
        <Card title="Severity Breakdown" width="50%">
          <Box flexDirection="column" gap={0}>
            <SeverityBar label="BLOCKER" count={severityCounts.blocker} max={maxCount} severity="blocker" />
            <SeverityBar label="HIGH" count={severityCounts.high} max={maxCount} severity="high" />
            <SeverityBar label="MEDIUM" count={severityCounts.medium} max={maxCount} severity="medium" />
            <SeverityBar label="LOW" count={severityCounts.low} max={maxCount} severity="low" />
            <SeverityBar label="NIT" count={severityCounts.nit} max={maxCount} severity="nit" />
          </Box>
        </Card>

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
