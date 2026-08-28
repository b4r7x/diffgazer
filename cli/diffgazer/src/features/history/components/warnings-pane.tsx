import type { RunIdLookup } from "@diffgazer/core/format";
import type { HistoryWarningSummary } from "@diffgazer/core/review";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Callout } from "../../../components/ui/callout";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SURFACE_BORDER } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

export function buildCompactWarningMessages(summary: HistoryWarningSummary): string[] {
  const messages: string[] = [];
  if (summary.unreadableReviewCount > 0) {
    messages.push(`${pluralize(summary.unreadableReviewCount, "saved review")} could not be read.`);
  }
  if (summary.droppedIssueCount > 0) {
    const issueCount = pluralize(summary.droppedIssueCount, "invalid saved issue");
    const verb = summary.droppedIssueCount === 1 ? "was" : "were";
    messages.push(`${issueCount} ${verb} omitted.`);
    messages.push("Re-run the affected reviews for complete results.");
  }
  if (summary.droppedExecutionReviewIds.length > 0) {
    const reviewCount = pluralize(summary.droppedExecutionReviewIds.length, "saved review");
    messages.push(`Execution details for ${reviewCount} could not be read.`);
  }
  if (summary.indexBuildFailed) {
    messages.push("The history index could not be rebuilt; reopen History to retry.");
  }
  if (summary.indexRewriteFailed) {
    messages.push("The history index could not be cleaned up; reopen History to retry.");
  }
  return messages;
}

export interface HistoryWarningsPaneProps {
  messages: readonly string[];
  targetIds: readonly string[];
  runIdLookup: RunIdLookup;
  showTargets: boolean;
  warningTargetHint: string | null;
  compact: boolean;
  detailRows: number;
  isDetailActive: boolean;
}

export function HistoryWarningsPane({
  messages,
  targetIds,
  runIdLookup,
  showTargets,
  warningTargetHint,
  compact,
  detailRows,
  isDetailActive,
}: HistoryWarningsPaneProps): ReactElement | null {
  const { tokens } = useTheme();
  if (messages.length === 0) return null;

  if (showTargets && targetIds.length > 0) {
    const scrollRows = Math.max(detailRows - 4, 1);
    return (
      <Box
        borderStyle={SURFACE_BORDER}
        borderColor={tokens.warning}
        paddingX={1}
        flexDirection="column"
        height={detailRows}
        flexShrink={0}
        overflow="hidden"
      >
        <Text bold>History warning · All affected run IDs</Text>
        <ScrollArea height={scrollRows} isActive={isDetailActive}>
          <Box flexDirection="column">
            {targetIds.map((id) => (
              <Text key={id} wrap="wrap">
                {`${runIdLookup.get(id) ?? id} ${id}`}
              </Text>
            ))}
          </Box>
        </ScrollArea>
        <Text color={tokens.muted}>Press w or Esc to hide IDs.</Text>
      </Box>
    );
  }

  return (
    <Callout variant="warning">
      <Callout.Title>
        {compact && warningTargetHint
          ? `History warning · ${warningTargetHint}`
          : "History warning"}
      </Callout.Title>
      {messages.map((message) => (
        <Callout.Content key={message}>{message}</Callout.Content>
      ))}
    </Callout>
  );
}
