import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { ReviewMetadata, ReviewIssue } from "@diffgazer/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/schemas/ui";
import { capitalize } from "@diffgazer/core/strings";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { SeverityBreakdown } from "../../review/components/severity-breakdown.js";
import { KeyValue } from "../../../components/ui/key-value.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { useNavigation } from "../../../app/navigation-context.js";
import { useTheme } from "../../../theme/theme-context.js";
import { severityColor } from "../../../theme/severity.js";

export interface HistoryInsightsPaneProps {
  review?: ReviewMetadata;
  issues?: ReviewIssue[];
  isActive?: boolean;
  scrollHeight?: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function buildSeverities(review: ReviewMetadata): Array<{ severity: string; count: number }> {
  const countMap: Record<string, number> = {
    blocker: review.blockerCount,
    high: review.highCount,
    medium: review.mediumCount,
    low: review.lowCount,
    nit: review.nitCount,
  };
  return SEVERITY_ORDER
    .map((severity) => ({ severity, count: countMap[severity] ?? 0 }))
    .filter((entry) => entry.count > 0);
}

export function HistoryInsightsPane({ review, issues = [], isActive = false, scrollHeight = 12 }: HistoryInsightsPaneProps): ReactElement {
  const { navigate } = useNavigation();
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (key.return && review) {
        navigate({ screen: "review", reviewId: review.id });
      }
    },
    { isActive },
  );

  if (!review) {
    return (
      <Box flexDirection="column" padding={1}>
        <EmptyState>
          <EmptyState.Message>Select a review</EmptyState.Message>
          <EmptyState.Description>
            Use arrow keys to highlight a review, then press Enter
          </EmptyState.Description>
        </EmptyState>
      </Box>
    );
  }

  const severities = buildSeverities(review);

  return (
    <Box flexDirection="column" padding={1}>
      <ScrollArea height={scrollHeight} isActive={isActive}>
        <SectionHeader>Review Details</SectionHeader>
        <Box marginTop={1} flexDirection="column">
          <KeyValue label="Date" value={formatDate(review.createdAt)} labelWidth={10} />
          <KeyValue label="Issues" value={String(review.issueCount)} labelWidth={10} />
          <KeyValue label="Duration" value={formatDuration(review.durationMs)} labelWidth={10} />
          <KeyValue label="Mode" value={review.mode} labelWidth={10} />
          <KeyValue label="Files" value={String(review.fileCount)} labelWidth={10} />
          {review.branch ? (
            <KeyValue label="Branch" value={review.branch} labelWidth={10} />
          ) : null}
        </Box>
        {severities.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            <SectionHeader variant="muted">Severity Breakdown</SectionHeader>
            <SeverityBreakdown issues={severities} />
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
    </Box>
  );
}
