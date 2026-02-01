import type { ReactElement } from "react";
import { Box } from "ink";
import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { TriageReviewMetadata } from "@repo/schemas/triage-storage";
import type { SessionMetadata } from "@repo/schemas/session";

type AnyReviewMetadata = ReviewHistoryMetadata | TriageReviewMetadata;
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
  reviews: AnyReviewMetadata[];
  sessions: SessionMetadata[];
  onResumeReview: (review: AnyReviewMetadata) => void;
  onExportReview: (review: AnyReviewMetadata) => void;
  onDeleteReview: (review: AnyReviewMetadata) => void;
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
