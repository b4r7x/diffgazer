import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { RunItem } from "./run-item.js";

export interface DateGroup {
  dateKey: string;
  label: string;
  reviews: Array<{
    id: string;
    displayId: string;
    branch: string;
    timestamp: string;
    summary: string;
    date: string;
    issueCount: number;
    severities: Array<{ severity: string; count: number }>;
  }>;
}

export interface TimelineListProps {
  dateGroups: DateGroup[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  emptyMessage?: string;
}

function DateGroupHeader({ label, count }: { label: string; count: number }): ReactElement {
  const { tokens } = useTheme();
  return (
    <Box paddingTop={1}>
      <Text color={tokens.muted} bold>
        {label}
      </Text>
      <Text color={tokens.muted}> ({count})</Text>
    </Box>
  );
}

export function TimelineList({
  dateGroups,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = true,
  emptyMessage = "No reviews available",
}: TimelineListProps): ReactElement {
  const allReviews = dateGroups.flatMap((g) => g.reviews);

  if (allReviews.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <EmptyState>
          <EmptyState.Message>{emptyMessage}</EmptyState.Message>
        </EmptyState>
      </Box>
    );
  }

  const children: ReactNode[] = [];
  for (const group of dateGroups) {
    children.push(
      <Box key={`header-${group.dateKey}`} marginLeft={1}>
        <DateGroupHeader label={group.label} count={group.reviews.length} />
      </Box>,
    );
    for (const review of group.reviews) {
      children.push(
        <NavigationList.Item key={review.id} id={review.id}>
          <RunItem
            displayId={review.displayId}
            branch={review.branch}
            timestamp={review.timestamp}
            summary={review.summary}
            issueCount={review.issueCount}
            severities={review.severities}
          />
        </NavigationList.Item>,
      );
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <NavigationList
        selectedId={selectedId}
        onSelect={onSelect}
        onHighlightChange={onHighlightChange}
        isActive={isActive}
      >
        {children}
      </NavigationList>
    </Box>
  );
}
