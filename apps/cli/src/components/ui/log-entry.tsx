import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export type LogTagType = "system" | "tool" | "lens" | "warning" | "error";

export interface LogEntryProps {
  timestamp: Date | string;
  tag: string;
  tagType?: LogTagType;
  message: ReactNode;
  isWarning?: boolean;
  isMuted?: boolean;
}

function formatTimestamp(timestamp: Date | string): string {
  if (typeof timestamp === "string") return timestamp;
  const hours = timestamp.getHours().toString().padStart(2, "0");
  const minutes = timestamp.getMinutes().toString().padStart(2, "0");
  const seconds = timestamp.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function LogEntry({
  timestamp,
  tag,
  tagType = "system",
  message,
  isWarning,
  isMuted,
}: LogEntryProps): ReactElement {
  const { colors } = useTheme();

  const tagColors: Record<LogTagType, string> = {
    system: colors.ui.accent,
    tool: colors.ui.info,
    lens: colors.ui.accent,
    warning: colors.ui.warning,
    error: colors.ui.error,
  };

  return (
    <Box>
      <Text color={colors.ui.textMuted} dimColor={isMuted}>
        [{formatTimestamp(timestamp)}]
      </Text>
      <Text> </Text>
      <Text color={tagColors[tagType]} bold dimColor={isMuted}>
        [{tag}]
      </Text>
      <Text color={colors.ui.textMuted}> {"->"} </Text>
      <Text
        color={isWarning ? colors.ui.warning : colors.ui.textMuted}
        dimColor={isMuted}
      >
        {isWarning && "\u26A0 "}
        {message}
      </Text>
    </Box>
  );
}
