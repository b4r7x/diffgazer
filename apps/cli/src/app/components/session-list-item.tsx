import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { SessionMetadata } from "@repo/schemas/session";
import { SelectionIndicator } from "./selection-indicator.js";
import { formatRelativeTime } from "../../lib/format.js";

interface SessionListItemProps {
  session: SessionMetadata;
  isSelected: boolean;
}

export function SessionListItem({ session, isSelected }: SessionListItemProps): ReactElement {
  return (
    <Box>
      <SelectionIndicator isSelected={isSelected} />
      <Text bold={isSelected}>{session.title ?? "Untitled"}</Text>
      <Text dimColor>
        {" "}({session.messageCount} msgs, {formatRelativeTime(session.updatedAt)})
      </Text>
    </Box>
  );
}
