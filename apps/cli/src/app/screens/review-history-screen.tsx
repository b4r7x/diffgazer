import type { ReactElement } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { ReviewHistoryMetadata, SavedReview } from "@repo/schemas/review-history";
import { useListNavigation, type ListState } from "../../hooks/index.js";
import { ListScreenWrapper } from "../../components/list-screen-wrapper.js";
import { DeleteConfirmation } from "../../components/delete-confirmation.js";
import { Separator } from "../../components/ui/separator.js";
import { ReviewListItem, IssueItem } from "../../features/review/index.js";
import { getScoreColor } from "../../lib/format.js";

interface ReviewHistoryScreenProps {
  reviews: ReviewHistoryMetadata[];
  currentReview: SavedReview | null;
  listState: ListState;
  error: { message: string } | null;
  onSelect: (review: ReviewHistoryMetadata) => void;
  onDelete: (review: ReviewHistoryMetadata) => void;
  onBack: () => void;
  onClearCurrent: () => void;
}

function ReviewDetailView({
  review,
  onBack,
}: {
  review: SavedReview;
  onBack: () => void;
}): ReactElement {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "b" || key.escape) {
      onBack();
    }
    if (input === "q") {
      exit();
    }
  });

  const { result, metadata, gitContext } = review;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Review Details
      </Text>
      <Separator />

      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text bold>Branch:</Text> {metadata.branch ?? "unknown"}
          {"  "}
          <Text bold>Type:</Text> {metadata.staged ? "Staged" : "Unstaged"}
          {"  "}
          <Text bold>Files:</Text> {gitContext.fileCount}
        </Text>
        <Text>
          <Text bold>Date:</Text> {new Date(metadata.createdAt).toLocaleString()}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={metadata.staged ? "green" : "yellow"}>
          Code Review ({metadata.staged ? "Staged" : "Unstaged"})
        </Text>
        <Text>
          <Text bold>Summary:</Text> {result.summary}
        </Text>
        {result.overallScore !== undefined && (
          <Text>
            <Text bold>Score:</Text>{" "}
            <Text color={getScoreColor(result.overallScore ?? null)}>
              {result.overallScore}/10
            </Text>
          </Text>
        )}
        {result.issues.length > 0 ? (
          result.issues.map((issue, i) => <IssueItem key={i} issue={issue} />)
        ) : (
          <Text color="green">No issues found!</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>[b] Back to list [q] Quit</Text>
      </Box>
    </Box>
  );
}

export function ReviewHistoryScreen({
  reviews,
  currentReview,
  listState,
  error,
  onSelect,
  onDelete,
  onBack,
  onClearCurrent,
}: ReviewHistoryScreenProps): ReactElement {
  const navigation = useListNavigation({
    items: reviews,
    onSelect,
    onDelete,
    onBack,
    disabled: currentReview !== null,
  });

  if (currentReview) {
    return <ReviewDetailView review={currentReview} onBack={onClearCurrent} />;
  }

  return (
    <ListScreenWrapper
      title="Review History"
      state={listState}
      error={error}
      isEmpty={reviews.length === 0}
      emptyMessage="No reviews found. Run a review with [r] to get started."
      emptyHints="[b] Back"
      loadingMessage="Loading reviews..."
    >
      {navigation.isConfirmingDelete ? (
        <DeleteConfirmation itemType="review" />
      ) : (
        <>
          <Box flexDirection="column" marginTop={1}>
            {reviews.map((review, index) => (
              <ReviewListItem
                key={review.id}
                review={review}
                isSelected={navigation.selectedIndex === index}
              />
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              [Enter] View [d] Delete [b] Back [q] Quit
            </Text>
          </Box>
        </>
      )}
    </ListScreenWrapper>
  );
}
