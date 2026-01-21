import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { SessionMetadata } from "@repo/schemas/session";
import { useListNavigation } from "../../hooks/use-list-navigation.js";
import { ListScreenWrapper } from "../components/list-screen-wrapper.js";
import { DeleteConfirmation } from "../components/delete-confirmation.js";
import { SessionListItem } from "../components/session-list-item.js";

interface SessionsScreenProps {
  sessions: SessionMetadata[];
  listState: "idle" | "loading" | "success" | "error";
  error: { message: string } | null;
  onSelect: (session: SessionMetadata) => void;
  onDelete: (session: SessionMetadata) => void;
  onBack: () => void;
  onNewSession: () => void;
}

export function SessionsScreen({
  sessions,
  listState,
  error,
  onSelect,
  onDelete,
  onBack,
  onNewSession,
}: SessionsScreenProps): ReactElement {
  const navigation = useListNavigation({
    items: sessions,
    onSelect,
    onDelete,
    onBack,
    extraHandlers: { n: onNewSession },
  });

  return (
    <ListScreenWrapper
      title="Session History"
      state={listState}
      error={error}
      isEmpty={sessions.length === 0}
      emptyMessage="No previous sessions found."
      emptyHints="[n] New Session [b] Back"
      loadingMessage="Loading sessions..."
    >
      {navigation.isConfirmingDelete ? (
        <DeleteConfirmation itemType="session" />
      ) : (
        <>
          <Box flexDirection="column" marginTop={1}>
            {sessions.map((session, index) => (
              <SessionListItem
                key={session.id}
                session={session}
                isSelected={navigation.selectedIndex === index}
              />
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              [Enter] Resume [n] New [d] Delete [b] Back [q] Quit
            </Text>
          </Box>
        </>
      )}
    </ListScreenWrapper>
  );
}
