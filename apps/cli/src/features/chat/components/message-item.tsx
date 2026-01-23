import { Box, Text } from "ink";
import type { SessionMessage } from "@repo/schemas/session";

interface MessageItemProps {
  message: SessionMessage;
}

const ROLE_COLORS = {
  user: "yellow",
  assistant: "green",
  system: "gray",
} as const;

const ROLE_LABELS = {
  user: "YOU",
  assistant: "ASSISTANT",
  system: "SYSTEM",
} as const;

export function MessageItem({ message }: MessageItemProps) {
  const color = ROLE_COLORS[message.role];
  const label = ROLE_LABELS[message.role];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color} bold>
          {label}:
        </Text>
      </Box>
      <Box marginLeft={2} marginBottom={1}>
        <Text wrap="wrap">{message.content}</Text>
      </Box>
    </Box>
  );
}
