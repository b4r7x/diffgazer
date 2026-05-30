import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context";
import type { CliColorTokens } from "../../../theme/palettes";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Badge } from "../../../components/ui/badge";
import { type LogEntryData, TAG_BADGE_VARIANTS } from "@diffgazer/core/schemas/presentation";
import { formatTimestamp } from "@diffgazer/core/format";

export interface ActivityLogProps {
  entries: LogEntryData[];
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

export function ActivityLog({ entries, height = 10, isActive = false }: ActivityLogProps) {
  const { tokens } = useTheme();

  return (
    <ScrollArea height={height} isActive={isActive} autoTail>
      {entries.map((entry) => (
        <Box key={entry.id} gap={1}>
          <Text color={tokens.muted}>{formatTimestamp(entry.timestamp)}</Text>
          <Badge variant={TAG_BADGE_VARIANTS[entry.tagType ?? "system"] ?? "neutral"}>{entry.tag}</Badge>
          {entry.source ? (
            <Text color={tokens.muted}>[{entry.source}]</Text>
          ) : null}
          <Text color={getLogEntryColor(entry, tokens)}>
            {entry.message}
          </Text>
        </Box>
      ))}
    </ScrollArea>
  );
}
