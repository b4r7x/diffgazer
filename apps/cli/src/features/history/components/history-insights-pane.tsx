import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageIssue } from "@repo/schemas";
import { capitalize } from "@repo/core";
import { useTheme } from "../../../hooks/use-theme.js";
import { Badge } from "../../../components/ui/badge.js";
import { SectionHeader } from "../../../components/ui/section-header.js";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  topLenses: string[];
  topIssues: TriageIssue[];
  duration?: string;
  onIssueClick?: (issueId: string) => void;
}


export function HistoryInsightsPane({
  runId,
  topLenses,
  topIssues,
  duration,
}: HistoryInsightsPaneProps): ReactElement {
  const { colors } = useTheme();

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
      <Box flexDirection="column">
        <Box paddingX={1}>
          <Text color={colors.ui.textMuted} bold>
            INSIGHTS: {runId}
          </Text>
        </Box>
        <Text color={colors.ui.border}>{"─".repeat(34)}</Text>
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
                    [{capitalize(issue.severity)}]
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
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.ui.border}>{"─".repeat(34)}</Text>
          <Box paddingX={1} flexDirection="column">
            <Text color={colors.ui.textMuted}>Duration</Text>
            <Text color={colors.ui.text} bold>{duration}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
