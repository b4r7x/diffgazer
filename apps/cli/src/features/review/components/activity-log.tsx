import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { Badge } from "../../../components/ui/badge.js";
import { type LogEntryData, TAG_BADGE_VARIANTS } from "@diffgazer/schemas/ui";
import { formatTimestamp } from "@diffgazer/core/format";

export interface ActivityLogProps {
  entries: LogEntryData[];
  height?: number;
  isActive?: boolean;
}

export function ActivityLog({ entries, height = 10, isActive = false }: ActivityLogProps) {
  const { tokens } = useTheme();

  return (
    <ScrollArea height={height} isActive={isActive}>
      {entries.map((entry) => (
        <Box key={entry.id} gap={1}>
          <Text color={tokens.muted}>{formatTimestamp(entry.timestamp)}</Text>
          <Badge variant={TAG_BADGE_VARIANTS[entry.tagType ?? "system"] ?? "neutral"}>{entry.tag}</Badge>
          {entry.source ? (
            <Text color={tokens.muted}>[{entry.source}]</Text>
          ) : null}
          <Text color={entry.isError ? tokens.error : entry.isWarning ? tokens.warning : undefined}>
            {entry.message}
          </Text>
        </Box>
      ))}
    </ScrollArea>
  );
}
