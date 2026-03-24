import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { Badge } from "../../../components/ui/badge.js";

export interface ActivityLogEntry {
  timestamp: string;
  message: string;
  variant?: "success" | "warning" | "error" | "info" | "neutral";
}

export interface ActivityLogProps {
  entries: ActivityLogEntry[];
  height?: number;
  isActive?: boolean;
}

export function ActivityLog({ entries, height = 10, isActive = false }: ActivityLogProps) {
  const { tokens } = useTheme();

  return (
    <ScrollArea height={height} isActive={isActive}>
      {entries.map((entry, i) => (
        <Box key={i} gap={1}>
          <Text color={tokens.muted}>{entry.timestamp}</Text>
          <Text>{entry.message}</Text>
          {entry.variant ? (
            <Badge variant={entry.variant}>{entry.variant}</Badge>
          ) : null}
        </Box>
      ))}
    </ScrollArea>
  );
}
