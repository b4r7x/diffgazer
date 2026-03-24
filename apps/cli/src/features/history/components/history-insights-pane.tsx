import type { ReactElement } from "react";
import { Box, useInput } from "ink";
import type { ReviewMetadata } from "@diffgazer/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/schemas/ui";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { SeverityBreakdown } from "../../review/components/severity-breakdown.js";
import { KeyValue } from "../../../components/ui/key-value.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { useNavigation } from "../../../app/navigation-context.js";

export interface HistoryInsightsPaneProps {
  review?: ReviewMetadata;
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

export function HistoryInsightsPane({ review, isActive = false, scrollHeight = 12 }: HistoryInsightsPaneProps): ReactElement {
  const { navigate } = useNavigation();

  useInput((_input, key) => {
    if (key.return && isActive && review) {
      navigate({ screen: "review", reviewId: review.id });
    }
  });

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
      <ScrollArea height={scrollHeight}>
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
      </ScrollArea>
    </Box>
  );
}
