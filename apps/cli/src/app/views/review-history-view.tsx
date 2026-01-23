import type { ReactElement } from "react";
import { Box } from "ink";
import { ReviewHistoryScreen } from "../screens/review-history-screen.js";
import type { ReviewHistoryMetadata, SavedReview } from "@repo/schemas/review-history";
import type { ListState } from "../../hooks/index.js";

interface ReviewHistoryViewProps {
  reviews: ReviewHistoryMetadata[];
  currentReview: SavedReview | null;
  listState: ListState;
  error: { message: string } | null;
  onSelect: (review: ReviewHistoryMetadata) => void;
  onDelete: (review: ReviewHistoryMetadata) => void;
  onBack: () => void;
  onClearCurrent: () => void;
}

export function ReviewHistoryView(props: ReviewHistoryViewProps): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <ReviewHistoryScreen {...props} />
    </Box>
  );
}
