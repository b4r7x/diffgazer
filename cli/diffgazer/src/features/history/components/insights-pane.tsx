import { SEVERITY_ORDER, type SeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { capitalize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { EmptyState } from "../../../components/ui/empty-state";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { SeverityBreakdown } from "../../../components/ui/severity/breakdown";
import { useTheme } from "../../../theme/provider";
import { severityColor } from "../../../theme/severity";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: SeverityCounts | null;
  issues: ReviewIssue[];
  duration?: string;
  isActive?: boolean;
  scrollHeight?: number;
  onIssueClick?: (issueId: string) => void;
}

function toSeverityList(counts: SeverityCounts) {
  return SEVERITY_ORDER.map((severity) => ({ severity, count: counts[severity] })).filter(
    (entry) => entry.count > 0,
  );
}

export function HistoryInsightsPane({
  runId,
  severityCounts,
  issues,
  duration,
  isActive = false,
  scrollHeight = 12,
  onIssueClick,
}: HistoryInsightsPaneProps): ReactElement {
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (key.return && runId && onIssueClick) {
        const first = issues[0];
        if (first) onIssueClick(first.id);
      }
    },
    { isActive },
  );

  if (!runId) {
    return (
      <Box flexDirection="column" padding={1}>
        <EmptyState>
          <EmptyState.Message>Select a run to view insights</EmptyState.Message>
        </EmptyState>
      </Box>
    );
  }

  const severityList = severityCounts ? toSeverityList(severityCounts) : [];

  return (
    <Box flexDirection="column" padding={1}>
      <SectionHeader variant="muted">{`Insights: Run ${runId}`}</SectionHeader>
      <ScrollArea height={scrollHeight} isActive={isActive}>
        {severityList.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            <SectionHeader variant="muted">Severity Breakdown</SectionHeader>
            <SeverityBreakdown issues={severityList} />
          </Box>
        ) : null}
        {issues.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            <SectionHeader variant="muted">{`${issues.length} Issues`}</SectionHeader>
            {issues.map((issue) => (
              <Box key={issue.id} gap={1}>
                <Text color={severityColor(issue.severity, tokens)} bold>
                  [{capitalize(issue.severity)}]
                </Text>
                <Text color={tokens.muted} dimColor>
                  {issue.line_start != null ? `L:${issue.line_start}` : ""}
                </Text>
                <Text color={tokens.fg} wrap="truncate">
                  {issue.title}
                </Text>
              </Box>
            ))}
          </Box>
        ) : null}
      </ScrollArea>
      {duration ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={tokens.muted} dimColor>
            DURATION
          </Text>
          <Text color={tokens.fg}>{duration}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
