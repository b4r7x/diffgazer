import type { ReactElement } from "react";
import { Box } from "ink";
import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { SessionMetadata } from "@repo/schemas/session";
import { HistoryScreen } from "../screens/history-screen.js";
import type { Shortcut } from "../../components/ui/branding/footer-bar.js";

export const HISTORY_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "Tab", label: "Focus" },
  { key: "Up/Down", label: "Navigate" },
  { key: "Enter", label: "Expand" },
  { key: "r", label: "Resume" },
  { key: "e", label: "Export" },
  { key: "b", label: "Back" },
];

interface HistoryViewProps {
  reviews: ReviewHistoryMetadata[];
  sessions: SessionMetadata[];
  onResumeReview: (review: ReviewHistoryMetadata) => void;
  onExportReview: (review: ReviewHistoryMetadata) => void;
  onDeleteReview: (review: ReviewHistoryMetadata) => void;
  onViewSession: (session: SessionMetadata) => void;
  onDeleteSession: (session: SessionMetadata) => void;
  onBack: () => void;
}

export function HistoryView(props: HistoryViewProps): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <HistoryScreen {...props} />
    </Box>
  );
}
