import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useReviews, useReview, guardQueryState } from "@diffgazer/core/api/hooks";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useResponsive } from "../../hooks/use-terminal-dimensions.js";
import { useTheme } from "../../theme/theme-context.js";
import { useNavigation } from "../navigation-context.js";
import { Panel } from "../../components/ui/panel.js";
import { SectionHeader } from "../../components/ui/section-header.js";
import { Spinner } from "../../components/ui/spinner.js";
import { EmptyState } from "../../components/ui/empty-state.js";
import { Input } from "../../components/ui/input.js";
import { TimelineList } from "../../features/history/components/timeline-list.js";
import { HistoryInsightsPane } from "../../features/history/components/history-insights-pane.js";
import { matchesSearch, groupByDate } from "../../features/history/utils.js";

type Zone = "search" | "timeline" | "insights";

export function HistoryScreen(): ReactElement {
  useScope("history");
  usePageFooter({
    shortcuts: [
      { key: "Esc", label: "Back" },
      { key: "Tab", label: "Switch pane" },
      { key: "/", label: "Search" },
      { key: "Enter", label: "Open review" },
    ],
  });
  useBackHandler();

  const { tokens } = useTheme();
  const { columns, rows, isNarrow, isMedium } = useResponsive();
  const { navigate } = useNavigation();

  const reviewsQuery = useReviews();
  const reviews = reviewsQuery.data?.reviews ?? [];
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<string | undefined>(undefined);

  const reviewDetailQuery = useReview(selectedReviewId ?? "");
  const reviewDetail = reviewDetailQuery.data?.review ?? null;
  const sortedIssues = reviewDetail?.result?.issues
    ? [...reviewDetail.result.issues].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
      )
    : [];
  const [activeZone, setActiveZone] = useState<Zone>("timeline");

  useInput((_input, key) => {
    if (key.tab) {
      setActiveZone((z) => {
        if (z === "search") return "timeline";
        if (z === "timeline") return "insights";
        return "search";
      });
    }
  });

  useInput(
    (input) => {
      if (input === "/") {
        setActiveZone("search");
      }
    },
    { isActive: activeZone !== "search" },
  );

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? reviews.filter((r) => matchesSearch(r, query))
    : reviews;

  const dateGroups = groupByDate(filtered);
  const allReviewItems = dateGroups.flatMap((g) => g.reviews);

  function handleSelect(id: string) {
    setSelectedReviewId(id);
    navigate({ screen: "review", reviewId: id });
  }

  function handleHighlightChange(id: string) {
    setSelectedReviewId(id);
  }

  const selectedReviewMetadata = filtered.find((r) => r.id === selectedReviewId);
  const listWidth = isMedium
    ? Math.max(Math.floor(columns * 0.35), 26)
    : Math.max(Math.floor(columns * 0.4), 30);
  const paneHeight = Math.max(rows - 8, 8);
  const insightScrollHeight = isNarrow
    ? Math.max(Math.floor(paneHeight / 2), 6)
    : isMedium
      ? Math.max(paneHeight - 4, 6)
      : paneHeight;

  const guard = guardQueryState(reviewsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Review History</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Spinner label="Loading reviews..." />
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Review History</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Text color={tokens.error}>Error: {err.message}</Text>
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    ),
  });

  if (guard) return guard;

  if ((reviewsQuery.data?.reviews ?? []).length === 0) {
    return (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Review History</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <EmptyState>
                <EmptyState.Message>No reviews yet</EmptyState.Message>
                <EmptyState.Description>
                  Run a review to see it here
                </EmptyState.Description>
              </EmptyState>
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    );
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Review History</SectionHeader>
          <Box>
            <Input
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by ID, branch, or project path..."
              size="lg"
              isActive={activeZone === "search"}
            />
          </Box>
          <Box flexDirection={isNarrow ? "column" : "row"}>
            <Box
              width={isNarrow ? undefined : listWidth}
              borderStyle="single"
              borderColor={activeZone === "timeline" ? tokens.accent : tokens.border}
            >
              <TimelineList
                dateGroups={dateGroups}
                selectedId={selectedReviewId}
                onSelect={handleSelect}
                onHighlightChange={handleHighlightChange}
                isActive={activeZone === "timeline"}
                emptyMessage={query ? "No reviews match this search" : "No reviews available"}
              />
            </Box>
            <Box
              flexGrow={1}
              borderStyle="single"
              borderColor={activeZone === "insights" ? tokens.accent : tokens.border}
            >
              <HistoryInsightsPane
                review={selectedReviewMetadata}
                issues={sortedIssues}
                isActive={activeZone === "insights"}
                scrollHeight={insightScrollHeight}
              />
            </Box>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
