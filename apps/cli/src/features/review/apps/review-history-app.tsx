import React, { useEffect, useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import type { TriageReviewMetadata } from "@repo/schemas/triage-storage";
import { useTriageHistory } from "../hooks/use-triage-history.js";
import { Separator } from "../../../components/ui/separator.js";
import { DeleteConfirmation } from "../../../components/delete-confirmation.js";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ReviewListItem({
  review,
  isSelected,
}: {
  review: TriageReviewMetadata;
  isSelected: boolean;
}): React.ReactElement {
  const prefix = isSelected ? "> " : "  ";

  return (
    <Box flexDirection="row">
      <Text color={isSelected ? "green" : undefined}>{prefix}</Text>
      <Text>{formatDate(review.createdAt)}</Text>
      <Text> | </Text>
      <Text>
        {review.issueCount} issues
        {review.blockerCount > 0 && (
          <Text color="red"> ({review.blockerCount} blocker)</Text>
        )}
        {review.highCount > 0 && (
          <Text color="magenta"> ({review.highCount} high)</Text>
        )}
      </Text>
      <Text> | </Text>
      <Text dimColor>
        {review.fileCount} files
        {review.branch && ` on ${review.branch}`}
        {review.profile && ` (${review.profile})`}
      </Text>
    </Box>
  );
}

export function ReviewHistoryApp(): React.ReactElement {
  const { exit } = useApp();
  const {
    items,
    listState,
    error,
    loadList,
    loadOne,
    remove,
    current,
  } = useTriageHistory();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    void loadList();
  }, []);

  useEffect(() => {
    if (selectedIndex >= items.length && items.length > 0) {
      setSelectedIndex(items.length - 1);
    }
  }, [items.length, selectedIndex]);

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id);
      setConfirmDelete(null);
    },
    [remove]
  );

  useInput((input, key) => {
    if (confirmDelete) {
      if (input === "y") {
        void handleDelete(confirmDelete);
      }
      if (input === "n" || key.escape) {
        setConfirmDelete(null);
      }
      return;
    }

    if (input === "j" || key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    }

    if (input === "k" || key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }

    if (key.return && items[selectedIndex]) {
      void loadOne(items[selectedIndex].id);
    }

    if (input === "d" && items[selectedIndex]) {
      setConfirmDelete(items[selectedIndex].id);
    }

    if (input === "r") {
      void loadList();
    }

    if (input === "q" || key.escape) {
      exit();
    }
  });

  if (listState === "loading") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Review History
        </Text>
        <Separator />
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading reviews...</Text>
        </Box>
      </Box>
    );
  }

  if (listState === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Review History
        </Text>
        <Separator />
        <Text color="red">Error: {error?.message ?? "Failed to load"}</Text>
        <Box marginTop={1}>
          <Text dimColor>[r] Retry  [q] Quit</Text>
        </Box>
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Review History
        </Text>
        <Separator />
        <Text>No reviews found</Text>
        <Box marginTop={1}>
          <Text dimColor>
            Run 'stargazer review' to perform a code review
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[q] Quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Review History
      </Text>
      <Separator />

      {confirmDelete && (
        <DeleteConfirmation itemType="review" />
      )}

      <Box flexDirection="column" marginTop={1}>
        {items.map((review, index) => (
          <ReviewListItem
            key={review.id}
            review={review}
            isSelected={index === selectedIndex}
          />
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          [j/k] Navigate  [Enter] Open  [d] Delete  [r] Refresh  [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
