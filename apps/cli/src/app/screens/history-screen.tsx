import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { ReviewMetadata } from "@diffgazer/schemas/review";
import { useReviews, useReview, matchQueryState } from "@diffgazer/api/hooks";
import { SEVERITY_ORDER } from "@diffgazer/schemas/ui";
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

type Zone = "search" | "timeline" | "insights";

interface ReviewItem {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
  date: string;
  issueCount: number;
  severities: Array<{ severity: string; count: number }>;
  duration: number;
  mode: string;
}

function getDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function getDateLabel(dateStr: string): string {
  const dateKey = getDateKey(dateStr);
  const now = new Date();
  const today = getDateKey(now.toISOString());
  const yesterday = getDateKey(new Date(now.getTime() - 86400000).toISOString());

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(durationMs: number | undefined): number {
  if (!durationMs) return 0;
  return Math.round(durationMs / 1000);
}

function getTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getRunSummary(r: ReviewMetadata): string {
  if (r.issueCount === 0) return "Passed with no issues.";
  const parts: string[] = [];
  if (r.blockerCount > 0) parts.push(`${r.blockerCount} blocker`);
  if (r.highCount > 0) parts.push(`${r.highCount} high`);
  if (r.mediumCount > 0) parts.push(`${r.mediumCount} medium`);
  if (r.lowCount > 0) parts.push(`${r.lowCount} low`);
  if (parts.length === 0) return `Found ${r.issueCount} issue${r.issueCount === 1 ? "" : "s"}.`;
  return parts.join(", ");
}

function metadataToSeverities(r: ReviewMetadata): Array<{ severity: string; count: number }> {
  const severities: Array<{ severity: string; count: number }> = [];
  if (r.blockerCount > 0) severities.push({ severity: "critical", count: r.blockerCount });
  if (r.highCount > 0) severities.push({ severity: "high", count: r.highCount });
  if (r.mediumCount > 0) severities.push({ severity: "medium", count: r.mediumCount });
  if (r.lowCount > 0) severities.push({ severity: "low", count: r.lowCount });
  if (r.nitCount > 0) severities.push({ severity: "nit", count: r.nitCount });
  return severities;
}

function toReviewItem(r: ReviewMetadata): ReviewItem {
  return {
    id: r.id,
    displayId: `#${r.id.slice(0, 4)}`,
    branch: r.mode === "staged" ? "Staged" : r.branch ?? "Main",
    timestamp: getTimestamp(r.createdAt),
    summary: getRunSummary(r),
    date: r.createdAt,
    issueCount: r.issueCount,
    severities: metadataToSeverities(r),
    duration: formatDuration(r.durationMs),
    mode: r.mode ?? "unstaged",
  };
}

function matchesSearch(r: ReviewMetadata, query: string): boolean {
  if (r.id.toLowerCase().includes(query)) return true;
  if (`#${r.id.slice(0, 4)}`.toLowerCase().includes(query)) return true;
  const branchText = r.mode === "staged" ? "staged" : (r.branch?.toLowerCase() ?? "main");
  if (branchText.includes(query)) return true;
  if (r.projectPath.toLowerCase().includes(query)) return true;
  return false;
}

export interface DateGroup {
  dateKey: string;
  label: string;
  reviews: ReviewItem[];
}

function groupByDate(reviews: ReviewMetadata[]): DateGroup[] {
  const groups = new Map<string, { label: string; items: ReviewItem[] }>();

  for (const r of reviews) {
    const key = getDateKey(r.createdAt);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(toReviewItem(r));
    } else {
      groups.set(key, { label: getDateLabel(r.createdAt), items: [toReviewItem(r)] });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, { label, items }]) => ({ dateKey, label, reviews: items }));
}

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

  useInput((input) => {
    if (input === "/" && activeZone !== "search") {
      setActiveZone("search");
    }
  });

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

  const guard = matchQueryState(reviewsQuery, {
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
    success: (data) => {
      if ((data?.reviews ?? []).length === 0) {
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
      return null;
    },
  });

  if (guard) return guard as ReactElement;

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
