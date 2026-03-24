import type { ReactElement } from "react";
import { Box } from "ink";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { RunItem } from "./run-item.js";

export interface TimelineListProps {
  reviews: Array<{
    id: string;
    date: string;
    issueCount: number;
    severities: Array<{ severity: string; count: number }>;
  }>;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
}

export function TimelineList({
  reviews,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = true,
}: TimelineListProps): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <NavigationList
        selectedId={selectedId}
        onSelect={onSelect}
        onHighlightChange={onHighlightChange}
        isActive={isActive}
      >
        {reviews.map((review) => (
          <NavigationList.Item key={review.id} id={review.id}>
            <RunItem
              date={review.date}
              issueCount={review.issueCount}
              severities={review.severities}
            />
          </NavigationList.Item>
        ))}
      </NavigationList>
    </Box>
  );
}
