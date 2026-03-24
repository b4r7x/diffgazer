import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { SeverityBreakdown } from "../../review/components/severity-breakdown.js";
import { KeyValue } from "../../../components/ui/key-value.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { SectionHeader } from "../../../components/ui/section-header.js";

export interface HistoryInsightsPaneProps {
  review?: {
    date: string;
    issueCount: number;
    severities: Array<{ severity: string; count: number }>;
    duration: number;
    mode: string;
  };
}

export function HistoryInsightsPane({ review }: HistoryInsightsPaneProps): ReactElement {
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

  return (
    <Box flexDirection="column" padding={1}>
      <ScrollArea height={12}>
        <SectionHeader>Review Details</SectionHeader>
        <Box marginTop={1} flexDirection="column">
          <KeyValue label="Date" value={review.date} labelWidth={10} />
          <KeyValue label="Issues" value={String(review.issueCount)} labelWidth={10} />
          <KeyValue label="Duration" value={`${review.duration}s`} labelWidth={10} />
          <KeyValue label="Mode" value={review.mode} labelWidth={10} />
        </Box>
        <Box marginTop={1} flexDirection="column">
          <SectionHeader variant="muted">Severity Breakdown</SectionHeader>
          <SeverityBreakdown issues={review.severities} />
        </Box>
      </ScrollArea>
    </Box>
  );
}
