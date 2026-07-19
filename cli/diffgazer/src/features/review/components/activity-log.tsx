import { formatTimestamp } from "@diffgazer/core/format";
import {
  convertAgentEventsToLogEntries,
  getReviewEventLogSource,
  getReviewEventSequence,
  type ReviewEvent,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
import { type LogEntryData, TAG_BADGE_VARIANTS } from "@diffgazer/core/schemas/presentation";
import { Box, type DOMElement, Text, useBoxMetrics } from "ink";
import { useRef } from "react";
import { Badge } from "../../../components/ui/badge";
import { ScrollArea } from "../../../components/ui/scroll-area";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";

export interface ActivityLogProps {
  events: readonly ReviewEvent[];
  height?: number;
  isActive?: boolean;
  sourceFilter?: string;
}

function getLogEntryColor(
  entry: Pick<LogEntryData, "isError" | "isWarning">,
  tokens: CliColorTokens,
): string | undefined {
  if (entry.isError) return tokens.error;
  if (entry.isWarning) return tokens.warning;
  return undefined;
}

export function ActivityLog({
  events,
  height = 10,
  isActive = false,
  sourceFilter,
}: ActivityLogProps) {
  const { tokens } = useTheme();
  const containerRef = useRef<DOMElement>(null);
  const { width, hasMeasured } = useBoxMetrics(containerRef);
  const contentWidth = hasMeasured ? Math.max(width, 1) : undefined;
  const visibleEvents = sourceFilter
    ? events.filter((event) => getReviewEventLogSource(event) === sourceFilter)
    : events;
  const eventSequence = getReviewEventSequence(events);
  const contentIdentity = sourceFilter ?? eventSequence?.stream;

  return (
    <Box ref={containerRef} flexDirection="column">
      <ScrollArea
        height={height}
        isActive={isActive}
        autoTail
        contentIdentity={contentIdentity}
        totalRows={visibleEvents.length}
      >
        {(range) =>
          convertAgentEventsToLogEntries(visibleEvents, range).map((entry) => (
            <Box
              key={entry.id}
              gap={1}
              width={contentWidth}
              height={1}
              overflow="hidden"
              flexWrap="nowrap"
            >
              <Text color={tokens.muted}>{formatTimestamp(entry.timestamp)}</Text>
              <Badge variant={TAG_BADGE_VARIANTS[entry.tagType ?? "system"] ?? "neutral"}>
                {entry.tag}
              </Badge>
              {entry.source ? (
                <Text color={tokens.muted} wrap="truncate-end">
                  [{entry.source}]
                </Text>
              ) : null}
              <Text color={getLogEntryColor(entry, tokens)} wrap="truncate-end">
                {sanitizeTerminalText(entry.message)}
              </Text>
            </Box>
          ))
        }
      </ScrollArea>
    </Box>
  );
}
