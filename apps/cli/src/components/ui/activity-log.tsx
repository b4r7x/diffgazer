import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { LogEntry, type LogTagType } from "./log-entry.js";
import { useTheme } from "../../hooks/use-theme.js";

export interface LogEntryData {
  id: string;
  timestamp: Date | string;
  tag: string;
  tagType?: LogTagType;
  message: string;
  isWarning?: boolean;
}

export interface ActivityLogProps {
  entries: LogEntryData[];
  showCursor?: boolean;
  autoScroll?: boolean;
}

export function ActivityLog({
  entries,
  showCursor,
}: ActivityLogProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column" gap={0}>
      {entries.map((entry) => (
        <LogEntry
          key={entry.id}
          timestamp={entry.timestamp}
          tag={entry.tag}
          tagType={entry.tagType}
          message={entry.message}
          isWarning={entry.isWarning}
        />
      ))}
      {showCursor && (
        <Text color={colors.ui.text}>{"\u2588"}</Text>
      )}
    </Box>
  );
}

export { type LogTagType } from "./log-entry.js";
