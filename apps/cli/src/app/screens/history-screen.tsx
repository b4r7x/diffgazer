import type { ReactElement } from "react";
import { useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { SessionMetadata } from "@repo/schemas/session";
import type { TriageIssue } from "@repo/schemas";
import { useTheme } from "../../hooks/use-theme.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";
import { FocusablePane } from "../../components/ui/focusable-pane.js";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { FooterBar, type Shortcut } from "../../components/ui/footer-bar.js";
import { TimelineList } from "../../features/history/components/timeline-list.js";
import { RunAccordionItem } from "../../features/history/components/run-accordion-item.js";
import { HistoryInsightsPane } from "../../features/history/components/history-insights-pane.js";
import { useHistoryState } from "../../features/history/hooks/use-history-state.js";
import { toHistoryRun } from "../../features/history/types.js";
import type { SeverityLevel } from "../../components/ui/severity-bar.js";

export interface HistoryScreenProps {
  reviews: ReviewHistoryMetadata[];
  sessions: SessionMetadata[];
  onResumeReview: (review: ReviewHistoryMetadata) => void;
  onExportReview: (review: ReviewHistoryMetadata) => void;
  onDeleteReview: (review: ReviewHistoryMetadata) => void;
  onViewSession: (session: SessionMetadata) => void;
  onDeleteSession: (session: SessionMetadata) => void;
  onBack: () => void;
}

function getSeverityCounts(issues: TriageIssue[]): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
  for (const issue of issues) {
    if (issue.severity in counts) {
      counts[issue.severity as SeverityLevel]++;
    }
  }
  return counts;
}

export function HistoryScreen({
  reviews,
  sessions,
  onResumeReview,
  onExportReview,
  onDeleteReview,
  onViewSession,
  onDeleteSession,
  onBack,
}: HistoryScreenProps): ReactElement {
  const { colors } = useTheme();
  const { exit } = useApp();
  const { columns, rows } = useTerminalDimensions();

  // Calculate available height: total rows - tabs(1) - footer(1)
  const contentHeight = Math.max(1, rows - 2);

  // Calculate proportional widths based on terminal columns
  const timelineWidth = Math.max(16, Math.floor(columns * 0.2));
  const insightsWidth = Math.max(24, Math.floor(columns * 0.25));
  // Account for borders (2 chars per pane = 6 total)
  const timelineDividerWidth = Math.max(1, timelineWidth - 2);
  const runsDividerWidth = Math.max(1, columns - timelineWidth - insightsWidth - 6);

  // Transform reviews to HistoryRuns
  const runs = useMemo(() => reviews.map(toHistoryRun), [reviews]);

  const historyState = useHistoryState({ runs });

  const {
    activeTab,
    focusZone,
    selectedDateId,
    selectedRunId,
    expandedRunId,
    timelineItems,
    filteredRuns,
    selectedRun,
    setActiveTab,
    setFocusZone,
    setSelectedDateId,
    setSelectedRunId,
    setExpandedRunId,
    cycleFocus,
    moveFocusLeft,
    moveFocusRight,
    toggleExpand,
    collapseOrBack,
  } = historyState;

  // Compute severity counts for insights
  const severityCounts = useMemo(
    () => (selectedRun ? getSeverityCounts(selectedRun.issues) : { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 }),
    [selectedRun]
  );

  const topLenses = ["Security", "Auth", "Performance"];
  const topIssues = selectedRun?.issues.slice(0, 3) ?? [];

  // Keyboard navigation
  useInput((input, key) => {
    // Tab to cycle focus zones
    if (key.tab) {
      cycleFocus();
      return;
    }

    // Left/Right arrows to move between zones
    if (key.leftArrow) {
      moveFocusLeft();
      return;
    }
    if (key.rightArrow) {
      moveFocusRight();
      return;
    }

    // h/l to switch tabs
    if (input === "h" && focusZone !== "timeline") {
      moveFocusLeft();
      return;
    }
    if (input === "l" && focusZone !== "insights") {
      moveFocusRight();
      return;
    }

    // j/k for list navigation within zones
    if (focusZone === "timeline" && (input === "j" || key.downArrow)) {
      const currentIndex = timelineItems.findIndex((item) => item.id === selectedDateId);
      const nextIndex = Math.min(currentIndex + 1, timelineItems.length - 1);
      const nextItem = timelineItems[nextIndex];
      if (nextItem) setSelectedDateId(nextItem.id);
      return;
    }
    if (focusZone === "timeline" && (input === "k" || key.upArrow)) {
      const currentIndex = timelineItems.findIndex((item) => item.id === selectedDateId);
      const prevIndex = Math.max(currentIndex - 1, 0);
      const prevItem = timelineItems[prevIndex];
      if (prevItem) setSelectedDateId(prevItem.id);
      return;
    }

    if (focusZone === "runs" && (input === "j" || key.downArrow)) {
      const currentIndex = filteredRuns.findIndex((run) => run.id === selectedRunId);
      const nextIndex = Math.min(currentIndex + 1, filteredRuns.length - 1);
      const nextRun = filteredRuns[nextIndex];
      if (nextRun) setSelectedRunId(nextRun.id);
      return;
    }
    if (focusZone === "runs" && (input === "k" || key.upArrow)) {
      const currentIndex = filteredRuns.findIndex((run) => run.id === selectedRunId);
      const prevIndex = Math.max(currentIndex - 1, 0);
      const prevRun = filteredRuns[prevIndex];
      if (prevRun) setSelectedRunId(prevRun.id);
      return;
    }

    // Enter to expand/collapse run
    if (key.return && focusZone === "runs") {
      toggleExpand();
      return;
    }

    // r to resume review
    if (input === "r" && selectedRunId) {
      const review = reviews.find((r) => r.id === selectedRunId);
      if (review) onResumeReview(review);
      return;
    }

    // e to export review
    if (input === "e" && selectedRunId) {
      const review = reviews.find((r) => r.id === selectedRunId);
      if (review) onExportReview(review);
      return;
    }

    // d to delete
    if (input === "d" && selectedRunId) {
      const review = reviews.find((r) => r.id === selectedRunId);
      if (review) onDeleteReview(review);
      return;
    }

    // Escape to collapse or go back
    if (key.escape) {
      if (!collapseOrBack()) {
        onBack();
      }
      return;
    }

    // b to go back
    if (input === "b") {
      onBack();
      return;
    }

    // q to quit
    if (input === "q") {
      exit();
    }
  });

  const shortcuts: Shortcut[] = [
    { key: "Tab", label: "Focus" },
    { key: "↑/↓", label: "Navigate" },
    { key: "Enter", label: "Expand" },
    { key: "r", label: "Resume" },
    { key: "e", label: "Export" },
    { key: "b", label: "Back" },
  ];

  return (
    <Box flexDirection="column" height="100%">
      {/* Tabs */}
      <Box paddingX={1}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "runs" | "sessions")} isActive={false}>
          <TabsList>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
        </Tabs>
      </Box>

      {/* 3-pane layout */}
      <Box height={contentHeight} flexDirection="row" overflow="hidden">
        {/* Timeline (left) */}
        <FocusablePane isFocused={focusZone === "timeline"} width={timelineWidth}>
          <Box flexDirection="column">
            <Box paddingX={1}>
              <Text color={colors.ui.textMuted} bold>TIMELINE</Text>
            </Box>
            <Text color={colors.ui.border}>{"─".repeat(timelineDividerWidth)}</Text>
          </Box>
          <Box flexDirection="column" paddingY={1}>
            <TimelineList
              items={timelineItems}
              selectedId={selectedDateId}
              onSelect={setSelectedDateId}
              isFocused={focusZone === "timeline"}
            />
          </Box>
        </FocusablePane>

        {/* Runs (middle) */}
        <FocusablePane isFocused={focusZone === "runs"} flexGrow={1}>
          <Box flexDirection="column">
            <Box paddingX={1} justifyContent="space-between">
              <Text color={colors.ui.textMuted} bold>RUNS</Text>
              <Text color={colors.ui.textMuted}>Sort: Recent</Text>
            </Box>
            <Text color={colors.ui.border}>{"─".repeat(runsDividerWidth)}</Text>
          </Box>
          <Box flexDirection="column">
            {activeTab === "runs" ? (
              filteredRuns.length > 0 ? (
                filteredRuns.map((run) => (
                  <RunAccordionItem
                    key={run.id}
                    id={run.id}
                    displayId={run.displayId}
                    branch={run.branch}
                    provider={run.provider}
                    timestamp={run.timestamp}
                    summary={run.summary}
                    issues={run.issues}
                    isSelected={run.id === selectedRunId}
                    isExpanded={run.id === expandedRunId}
                    criticalCount={run.criticalCount}
                    warningCount={run.warningCount}
                  />
                ))
              ) : (
                <Box paddingX={1} paddingY={1}>
                  <Text color={colors.ui.textMuted}>No runs for this date</Text>
                </Box>
              )
            ) : (
              <Box paddingX={1} paddingY={1}>
                <Text color={colors.ui.textMuted}>Sessions tab - coming soon</Text>
              </Box>
            )}
          </Box>
        </FocusablePane>

        {/* Insights (right) */}
        <FocusablePane isFocused={focusZone === "insights"} width={insightsWidth}>
          <HistoryInsightsPane
            runId={selectedRun?.displayId ?? null}
            severityCounts={severityCounts}
            topLenses={topLenses}
            topIssues={topIssues}
          />
        </FocusablePane>
      </Box>

      {/* Footer */}
      <FooterBar shortcuts={shortcuts} />
    </Box>
  );
}
