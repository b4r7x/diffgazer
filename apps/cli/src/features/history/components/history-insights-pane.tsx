import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../hooks/use-theme.js";
import { SeverityBar, type SeverityLevel } from "../../../components/ui/severity-bar.js";
import { Badge } from "../../../components/ui/badge.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import type { TriageIssue } from "@repo/schemas";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: Record<SeverityLevel, number>;
  topLenses: string[];
  topIssues: TriageIssue[];
  duration?: string;
  onIssueClick?: (issueId: string) => void;
}

const SEVERITY_ORDER: SeverityLevel[] = ["blocker", "high", "medium", "low"];

export function HistoryInsightsPane({
  runId,
  severityCounts,
  topLenses,
  topIssues,
  duration,
}: HistoryInsightsPaneProps): ReactElement {
  const { colors } = useTheme();

  const maxCount = Math.max(...Object.values(severityCounts), 1);

  if (!runId) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Text color={colors.ui.textMuted}>Select a run to view insights</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box paddingX={1} paddingY={0} borderStyle="single" borderColor={colors.ui.border} borderLeft={false} borderRight={false} borderTop={false}>
        <Text color={colors.ui.textMuted} bold>
          INSIGHTS: {runId}
        </Text>
      </Box>

      {/* Severity Histogram */}
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        <SectionHeader>Severity Histogram</SectionHeader>
        <Box flexDirection="column" marginTop={1}>
          {SEVERITY_ORDER.map((severity) => (
            <SeverityBar
              key={severity}
              label={severity.charAt(0).toUpperCase() + severity.slice(1)}
              count={severityCounts[severity] ?? 0}
              max={maxCount}
              severity={severity}
              barWidth={15}
            />
          ))}
        </Box>
      </Box>

      {/* Top Lenses */}
      {topLenses.length > 0 && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <SectionHeader>Top Lenses</SectionHeader>
          <Box marginTop={1} gap={1} flexWrap="wrap">
            {topLenses.map((lens) => (
              <Badge key={lens} text={lens} variant="muted" />
            ))}
          </Box>
        </Box>
      )}

      {/* Top Issues */}
      {topIssues.length > 0 && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <SectionHeader>{`Top ${topIssues.length} Issues`}</SectionHeader>
          <Box flexDirection="column" marginTop={1}>
            {topIssues.slice(0, 3).map((issue) => (
              <Box key={issue.id} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text
                    color={
                      issue.severity === "blocker"
                        ? colors.severity.blocker
                        : issue.severity === "high"
                          ? colors.severity.high
                          : issue.severity === "medium"
                            ? colors.severity.medium
                            : colors.severity.low
                    }
                    bold
                  >
                    [{issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}]
                  </Text>
                  <Box flexGrow={1} />
                  <Text color={colors.ui.textMuted}>L:{issue.line_start}</Text>
                </Box>
                <Text color={colors.ui.textMuted} wrap="truncate">
                  {issue.title}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Duration footer */}
      {duration && (
        <Box paddingX={1} marginTop={1} borderStyle="single" borderColor={colors.ui.border} borderLeft={false} borderRight={false} borderBottom={false}>
          <Box flexDirection="column">
            <Text color={colors.ui.textMuted}>Duration</Text>
            <Text color={colors.ui.text} bold>{duration}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
