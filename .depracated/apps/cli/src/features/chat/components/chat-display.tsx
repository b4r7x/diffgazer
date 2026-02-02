import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { Session } from "@repo/schemas/session";
import { MessageItem } from "./message-item.js";
import type { ChatState } from "../hooks/use-chat.js";

interface ChatDisplayProps {
  session: Session;
  chatState: ChatState;
}

export function ChatDisplay({ session, chatState }: ChatDisplayProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Chat: {session.metadata.title || "Untitled Session"}
        </Text>
        <Text color="gray"> ({session.metadata.messageCount} messages)</Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        {session.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {chatState.status === "loading" && (
          <Box flexDirection="column">
            <Box>
              <Text color="green" bold>ASSISTANT: </Text>
              <Text color="cyan"><Spinner type="dots" /></Text>
            </Box>
            {chatState.streamContent && (
              <Box marginLeft={2}>
                <Text>{chatState.streamContent}</Text>
              </Box>
            )}
          </Box>
        )}

        {chatState.status === "error" && (
          <Box>
            <Text color="red">Error: {chatState.error.message}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
