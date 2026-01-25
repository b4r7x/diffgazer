import type { ReactElement } from "react";
import { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { SessionMetadataInfo } from "@repo/core/storage";
import { formatRelativeTime } from "@repo/core";
import { useListNavigation, type ListState } from "../../hooks/index.js";
import { Card } from "../../components/ui/card.js";
import { Badge } from "../../components/ui/badge.js";
import { SelectionIndicator } from "../../components/selection-indicator.js";
import { DeleteConfirmation } from "../../components/delete-confirmation.js";
import { Separator } from "../../components/ui/separator.js";

type TabId = "reviews" | "sessions";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "reviews", label: "Reviews" },
  { id: "sessions", label: "Sessions" },
];

interface ReviewItemProps {
  review: ReviewHistoryMetadata;
  isSelected: boolean;
}

function ReviewItem({ review, isSelected }: ReviewItemProps): ReactElement {
  return (
    <Box>
      <SelectionIndicator isSelected={isSelected} />
      <Text bold={isSelected}>{review.branch ?? "unknown"}</Text>
      <Box marginLeft={1}>
        <Badge text={review.staged ? "staged" : "unstaged"} variant="muted" bold={false} />
      </Box>
      <Text dimColor>
        {" "}{review.issueCount} issues
        {review.criticalCount > 0 && <Text color="red"> {review.criticalCount}C</Text>}
        {review.warningCount > 0 && <Text color="yellow"> {review.warningCount}W</Text>}
        {", "}{formatRelativeTime(review.createdAt)}
      </Text>
    </Box>
  );
}

interface SessionEventItemProps {
  session: SessionMetadataInfo;
  isSelected: boolean;
}

function SessionEventItem({ session, isSelected }: SessionEventItemProps): ReactElement {
  const createdDate = new Date(session.createdAt);

  return (
    <Box>
      <SelectionIndicator isSelected={isSelected} />
      <Text bold={isSelected}>{createdDate.toLocaleDateString()}</Text>
      <Box marginLeft={1}>
        <Badge text={`${session.eventCount} events`} variant="info" bold={false} />
      </Box>
      <Text dimColor>
        {" "}{createdDate.toLocaleTimeString()}
      </Text>
    </Box>
  );
}

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function TabBar({ activeTab, onTabChange: _onTabChange }: TabBarProps): ReactElement {
  return (
    <Box marginBottom={1}>
      {TABS.map((tab, index) => (
        <Box key={tab.id}>
          {index > 0 && <Text dimColor> | </Text>}
          <Text
            bold={activeTab === tab.id}
            color={activeTab === tab.id ? "cyan" : undefined}
            dimColor={activeTab !== tab.id}
          >
            {tab.label}
          </Text>
        </Box>
      ))}
      <Text dimColor> (Tab/h/l to switch)</Text>
    </Box>
  );
}

export type ReviewAction = "resume" | "export" | "delete";
export type SessionAction = "view_timeline" | "delete";

interface HistoryScreenProps {
  reviews: ReviewHistoryMetadata[];
  sessions: SessionMetadataInfo[];
  reviewsState: ListState;
  sessionsState: ListState;
  reviewsError: { message: string } | null;
  sessionsError: { message: string } | null;
  onReviewAction: (review: ReviewHistoryMetadata, action: ReviewAction) => void;
  onSessionAction: (session: SessionMetadataInfo, action: SessionAction) => void;
  onBack: () => void;
}

export function HistoryScreen({
  reviews,
  sessions,
  reviewsState,
  sessionsState,
  reviewsError,
  sessionsError,
  onReviewAction,
  onSessionAction,
  onBack,
}: HistoryScreenProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>("reviews");
  const { exit } = useApp();

  const isReviewsTab = activeTab === "reviews";
  const currentItems = isReviewsTab ? reviews : sessions;
  const currentState = isReviewsTab ? reviewsState : sessionsState;
  const currentError = isReviewsTab ? reviewsError : sessionsError;

  const reviewNavigation = useListNavigation({
    items: reviews.map((r) => ({ ...r, id: r.id })),
    onSelect: (review) => onReviewAction(review, "resume"),
    onDelete: (review) => onReviewAction(review, "delete"),
    onBack,
    disabled: !isReviewsTab,
    extraHandlers: {
      e: () => {
        const review = reviews[reviewNavigation.selectedIndex];
        if (review) onReviewAction(review, "export");
      },
    },
  });

  const sessionNavigation = useListNavigation({
    items: sessions.map((s) => ({ ...s, id: s.sessionId })),
    onSelect: (session) => {
      const original = sessions.find((s) => s.sessionId === session.sessionId);
      if (original) onSessionAction(original, "view_timeline");
    },
    onDelete: (session) => {
      const original = sessions.find((s) => s.sessionId === session.sessionId);
      if (original) onSessionAction(original, "delete");
    },
    onBack,
    disabled: isReviewsTab,
  });

  const navigation = isReviewsTab ? reviewNavigation : sessionNavigation;

  useInput((input, key) => {
    if (navigation.isConfirmingDelete) return;

    if (key.tab || input === "l") {
      setActiveTab((prev) => (prev === "reviews" ? "sessions" : "reviews"));
    }
    if (input === "h") {
      setActiveTab((prev) => (prev === "sessions" ? "reviews" : "sessions"));
    }
    if (input === "q") {
      exit();
    }
  });

  const renderLoading = (message: string): ReactElement => (
    <Box flexDirection="column">
      <Text>{message}</Text>
    </Box>
  );

  const renderError = (error: { message: string }): ReactElement => (
    <Box flexDirection="column">
      <Text color="red">Error: {error.message}</Text>
    </Box>
  );

  const renderEmpty = (message: string): ReactElement => (
    <Box flexDirection="column">
      <Text dimColor>{message}</Text>
    </Box>
  );

  const renderReviewsList = (): ReactElement => {
    if (reviewNavigation.isConfirmingDelete) {
      return <DeleteConfirmation itemType="review" />;
    }

    return (
      <>
        <Box flexDirection="column">
          {reviews.map((review, index) => (
            <ReviewItem
              key={review.id}
              review={review}
              isSelected={reviewNavigation.selectedIndex === index}
            />
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            [Enter] Resume [e] Export [d] Delete [b] Back [q] Quit
          </Text>
        </Box>
      </>
    );
  };

  const renderSessionsList = (): ReactElement => {
    if (sessionNavigation.isConfirmingDelete) {
      return <DeleteConfirmation itemType="session" />;
    }

    return (
      <>
        <Box flexDirection="column">
          {sessions.map((session, index) => (
            <SessionEventItem
              key={session.sessionId}
              session={session}
              isSelected={sessionNavigation.selectedIndex === index}
            />
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            [Enter] View timeline [d] Delete [b] Back [q] Quit
          </Text>
        </Box>
      </>
    );
  };

  const renderContent = (): ReactElement => {
    if (currentState === "loading") {
      return renderLoading(isReviewsTab ? "Loading reviews..." : "Loading sessions...");
    }

    if (currentState === "error" && currentError) {
      return renderError(currentError);
    }

    if (currentItems.length === 0) {
      return renderEmpty(
        isReviewsTab
          ? "No reviews found. Run a review to get started."
          : "No sessions found."
      );
    }

    return isReviewsTab ? renderReviewsList() : renderSessionsList();
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Card title="History" titleColor="cyan">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <Separator />
        <Box marginTop={1} flexDirection="column">
          {renderContent()}
        </Box>
      </Card>
    </Box>
  );
}
