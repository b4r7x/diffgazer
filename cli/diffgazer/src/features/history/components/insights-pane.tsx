import { type HistoryDetailState, sanitizeTerminalText } from "@diffgazer/core/review";
import { SEVERITY_ORDER, type SeverityCounts } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { capitalize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { EmptyState } from "../../../components/ui/empty-state";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useListNavigation } from "../../../hooks/use-list-navigation";
import { getListWindow } from "../../../lib/list-window";
import { selectionHue } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { severityColor } from "../../../theme/severity";

const COMPACT_SEVERITY_LABELS = {
  blocker: "B",
  high: "H",
  medium: "M",
  low: "L",
  nit: "N",
} as const;

export interface HistoryInsightsPaneProps {
  runId: string | null;
  severityCounts: SeverityCounts | null;
  issues: ReviewIssue[];
  detailState?: HistoryDetailState;
  duration?: string;
  isActive?: boolean;
  scrollHeight?: number;
  onOpenReview?: (issueId?: string) => void;
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
  const issueNavigation = useListNavigation({
    items: issues.map((issue) => ({ id: issue.id, disabled: false })),
    wrap: false,
  });
  const highlightedIssueIndex = Math.max(
    issues.findIndex((issue) => issue.id === issueNavigation.currentHighlightedId),
    0,
  );
  const effectiveHighlightedIssueId = issues[highlightedIssueIndex]?.id;
  const issueWindow = getListWindow({
    selectedIndex: highlightedIssueIndex,
    total: issues.length,
    viewportRows: Math.max(scrollHeight - 2, 1),
  });
  const visibleIssues = issues.slice(issueWindow.start, issueWindow.end);

  useInput(
    (input, key) => {
      if (input === "r" && detailState.status === "error") {
        detailState.retry();
        return;
      }

      if (detailState.status === "ready" && issues.length > 0) {
        if (key.downArrow || input === "j") {
          issueNavigation.moveBy(1);
          return;
        }
        if (key.upArrow || input === "k") {
          issueNavigation.moveBy(-1);
          return;
        }
      }

      if (key.return && detailState.status === "ready" && runId && onOpenReview) {
        onOpenReview(effectiveHighlightedIssueId);
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

  return (
    <Box flexDirection="column" padding={1}>
      <SectionHeader variant="muted">{`Insights: Run ${sanitizeTerminalText(runId)}`}</SectionHeader>
      {detailState.status === "ready" && issues.length > 0 ? (
        <Box marginTop={1} flexDirection="column" height={scrollHeight} overflow="hidden">
          <SectionHeader variant="muted">{`${issues.length} Issues`}</SectionHeader>
          {issueWindow.canScrollUp ? <Text color={tokens.muted}>▲</Text> : null}
          {visibleIssues.map((issue) => {
            const isHighlighted = isActive && issue.id === effectiveHighlightedIssueId;
            return (
              <Box key={issue.id} gap={1} height={1} overflow="hidden">
                <Box flexShrink={0}>
                  <Text color={selectionHue(tokens)}>{isHighlighted ? "\u2502" : " "}</Text>
                </Box>
                <Box flexShrink={0}>
                  <Text color={severityColor(issue.severity, tokens)} bold>
                    [{capitalize(issue.severity)}]
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <Text color={tokens.muted}>
                    {issue.line_start != null ? `L:${issue.line_start}` : ""}
                  </Text>
                </Box>
                <Box flexShrink={1} minWidth={0}>
                  <Text color={tokens.fg} bold={isHighlighted} wrap="truncate">
                    {sanitizeTerminalText(issue.title)}
                  </Text>
                </Box>
              </Box>
            );
          })}
          {issueWindow.canScrollDown ? <Text color={tokens.muted}>▼</Text> : null}
        </Box>
      ) : (
        <ScrollArea height={scrollHeight} isActive={isActive}>
          {severityCounts ? (
            <Box marginTop={1} flexDirection="column">
              <SectionHeader variant="muted">Severity Breakdown</SectionHeader>
              <Box gap={1}>
                {SEVERITY_ORDER.map((severity) => (
                  <Text key={severity} color={severityColor(severity, tokens)}>
                    {`${COMPACT_SEVERITY_LABELS[severity]}${String(severityCounts[severity])}`}
                  </Text>
                ))}
              </Box>
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
              <Text color={tokens.muted}>
                {isActive ? "Press r to retry" : "Focus this pane, then press r to retry"}
              </Text>
            </Box>
          ) : null}
          {duration ? (
            <Box marginTop={1} flexDirection="column">
              <Text color={tokens.muted}>DURATION</Text>
              <Text color={tokens.fg}>{duration}</Text>
            </Box>
          ) : null}
        </ScrollArea>
      )}
    </Box>
  );
}
