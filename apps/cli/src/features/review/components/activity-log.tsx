import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { Badge } from "../../../components/ui/badge.js";
import type { LogEntryData } from "@diffgazer/schemas/ui";

function formatTimestamp(ts: string | Date): string {
  if (typeof ts === "string") {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return ts;
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${m}:${s}`;
  }
  const m = String(ts.getMinutes()).padStart(2, "0");
  const s = String(ts.getSeconds()).padStart(2, "0");
  return `${m}:${s}`;
}

function tagToBadgeVariant(tagType: LogEntryData["tagType"]): "info" | "success" | "warning" | "error" | "neutral" {
  switch (tagType) {
    case "error": return "error";
    case "warning": return "warning";
    case "system": return "info";
    case "agent": return "success";
    case "tool": return "neutral";
    case "thinking": return "neutral";
    case "lens": return "info";
    default: return "neutral";
  }
}

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
          <Badge variant={tagToBadgeVariant(entry.tagType)}>{entry.tag}</Badge>
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
