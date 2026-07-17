import { formatTimestamp } from "@diffgazer/core/format";
import {
  convertAgentEventsToLogEntries,
  getReviewEventSequence,
  type ReviewEvent,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
import { type LogEntryData, TAG_BADGE_VARIANTS } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
import { ScrollArea } from "../../../components/ui/scroll-area";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";

export interface ActivityLogProps {
  events: readonly ReviewEvent[];
  height?: number;
  isActive?: boolean;
}

function getLogEntryColor(
  entry: Pick<LogEntryData, "isError" | "isWarning">,
  tokens: CliColorTokens,
): string | undefined {
  if (entry.isError) return tokens.error;
  if (entry.isWarning) return tokens.warning;
  return undefined;
}

export function ActivityLog({ events, height = 10, isActive = false }: ActivityLogProps) {
  const { tokens } = useTheme();
  const eventSequence = getReviewEventSequence(events);

  return (
    <ScrollArea
      height={height}
      isActive={isActive}
      autoTail
      contentIdentity={eventSequence?.stream}
      totalRows={events.length}
    >
      {(range) =>
        convertAgentEventsToLogEntries(events, range).map((entry) => (
          <Box key={entry.id} gap={1}>
            <Text color={tokens.muted}>{formatTimestamp(entry.timestamp)}</Text>
            <Badge variant={TAG_BADGE_VARIANTS[entry.tagType ?? "system"] ?? "neutral"}>
              {entry.tag}
            </Badge>
            {entry.source ? <Text color={tokens.muted}>[{entry.source}]</Text> : null}
            <Text color={getLogEntryColor(entry, tokens)}>
              {sanitizeTerminalText(entry.message)}
            </Text>
          </Box>
        ))
      }
    </ScrollArea>
  );
}
