import { sanitizeTerminalText } from "@diffgazer/core/review";
import { SEVERITY_ORDER, type SeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { capitalize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { SeverityBreakdown } from "../../../components/shared/severity/breakdown";
import { EmptyState } from "../../../components/ui/empty-state";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useTheme } from "../../../theme/provider";
import { severityColor } from "../../../theme/severity";
import type { HistoryDetailState } from "../types";

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: SeverityCounts | null;
  issues: ReviewIssue[];
  detailState?: HistoryDetailState;
  duration?: string;
  isActive?: boolean;
  scrollHeight?: number;
  onOpenReview?: () => void;
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
  detailState = { status: "ready" },
  duration,
  isActive = false,
  scrollHeight = 12,
  onOpenReview,
}: HistoryInsightsPaneProps): ReactElement {
  const { tokens } = useTheme();

  useInput(
    (input, key) => {
      if (input === "r" && detailState.status === "error") {
        detailState.retry();
        return;
      }

      if (key.return && detailState.status === "ready" && runId && onOpenReview) {
        onOpenReview();
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
      <SectionHeader variant="muted">{`Insights: Run ${sanitizeTerminalText(runId)}`}</SectionHeader>
      <ScrollArea height={scrollHeight} isActive={isActive}>
        {severityList.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            <SectionHeader variant="muted">Severity Breakdown</SectionHeader>
            <SeverityBreakdown issues={severityList} />
          </Box>
        ) : null}
        {detailState.status === "loading" ? (
          <Box marginTop={1}>
            <Spinner label="Loading review details..." />
          </Box>
        ) : null}
        {detailState.status === "error" ? (
          <Box marginTop={1} flexDirection="column">
            <Text color={tokens.error}>
              Could not load review details: {sanitizeTerminalText(detailState.message)}
            </Text>
            <Text color={tokens.muted} dimColor>
              {isActive ? "Press r to retry" : "Focus this pane, then press r to retry"}
            </Text>
          </Box>
        ) : null}
        {detailState.status === "ready" && issues.length > 0 ? (
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
                  {sanitizeTerminalText(issue.title)}
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
