import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import { SelectionIndicator } from "../../../components/selection-indicator.js";
import { formatRelativeTime, getScoreColor } from "../../../lib/format.js";

interface ReviewListItemProps {
  review: ReviewHistoryMetadata;
  isSelected: boolean;
}

export function ReviewListItem({ review, isSelected }: ReviewListItemProps): ReactElement {
  return (
    <Box>
      <SelectionIndicator isSelected={isSelected} />
      <Text bold={isSelected}>{review.branch ?? "unknown"}</Text>
      <Text dimColor>
        {" "}({review.staged ? "staged" : "unstaged"}, {review.issueCount} issues
        {review.criticalCount > 0 && <Text color="red"> {review.criticalCount}C</Text>}
        {review.warningCount > 0 && <Text color="yellow"> {review.warningCount}W</Text>}
        , score: <Text color={getScoreColor(review.overallScore)}>{review.overallScore ?? "?"}</Text>
        , {formatRelativeTime(review.createdAt)})
      </Text>
    </Box>
  );
}
