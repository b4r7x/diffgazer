import type { ReactElement } from "react";
import { Box } from "ink";
import { SessionsScreen } from "../screens/sessions-screen.js";
import type { SessionMetadata } from "@repo/schemas/session";
import type { ListState } from "../../hooks/index.js";

interface SessionsViewProps {
  sessions: SessionMetadata[];
  listState: ListState;
  error: { message: string } | null;
  onSelect: (session: SessionMetadata) => void;
  onDelete: (session: SessionMetadata) => void;
  onBack: () => void;
  onNewSession: () => void;
}

export function SessionsView(props: SessionsViewProps): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <SessionsScreen {...props} />
    </Box>
  );
}
