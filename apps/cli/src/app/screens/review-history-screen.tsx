import type { ReactElement } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { ReviewHistoryMetadata, SavedReview } from "@repo/schemas/review-history";
import type { ReviewIssue, ReviewSeverity } from "@repo/schemas/review";
import { useListNavigation } from "../../hooks/use-list-navigation.js";
import { ListScreenWrapper } from "../components/list-screen-wrapper.js";
import { DeleteConfirmation } from "../components/delete-confirmation.js";
import { ReviewListItem } from "../components/review-list-item.js";
import { getScoreColor } from "../../lib/format.js";

interface ReviewHistoryScreenProps {
  reviews: ReviewHistoryMetadata[];
  currentReview: SavedReview | null;
  listState: "idle" | "loading" | "success" | "error";
  error: { message: string } | null;
  onSelect: (review: ReviewHistoryMetadata) => void;
  onDelete: (review: ReviewHistoryMetadata) => void;
  onBack: () => void;
  onClearCurrent: () => void;
}

const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  critical: "red",
  warning: "yellow",
  suggestion: "blue",
  nitpick: "gray",
};

function IssueItem({ issue }: { issue: ReviewIssue }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={SEVERITY_COLORS[issue.severity]} bold>
        [{issue.severity}] {issue.title}
      </Text>
      {issue.file && (
        <Text dimColor>
          {"  "}File: {issue.file}
          {issue.line ? `:${issue.line}` : ""}
        </Text>
      )}
      <Text>{"  "}{issue.description}</Text>
      {issue.suggestion && <Text color="green">{"  "}Fix: {issue.suggestion}</Text>}
    </Box>
  );
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
      <Text dimColor>{"─".repeat(40)}</Text>

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

  // Show detail view if a review is loaded
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
