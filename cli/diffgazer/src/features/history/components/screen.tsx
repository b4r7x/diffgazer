import { guardQueryState } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { EmptyState } from "../../../components/ui/empty-state.js";
import { Input } from "../../../components/ui/input.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider.js";
import { useHistoryScreen } from "../hooks/use-screen.js";
import { getHistoryFooter } from "../lib/history-footer.js";
import { HistoryInsightsPane } from "./insights-pane.js";
import { RunsList } from "./runs-list.js";
import { SectionsList } from "./sections-list.js";

function getInsightScrollHeight({
  isNarrow,
  isMedium,
  paneHeight,
}: {
  isNarrow: boolean;
  isMedium: boolean;
  paneHeight: number;
}): number {
  if (isNarrow) return Math.max(Math.floor(paneHeight / 2), 6);
  if (isMedium) return Math.max(paneHeight - 4, 6);
  return paneHeight;
}

export function HistoryScreen(): ReactElement {
  const { tokens } = useTheme();
  const { columns, rows, isNarrow, isMedium } = useResponsive();
  const { navigate } = useNavigation();

  const screen = useHistoryScreen({
    onOpenReview: (reviewId) => navigate({ screen: "review", reviewId }),
  });

  useBackHandler({ isActive: screen.focusZone !== "search" });

  const { shortcuts, rightShortcuts } = getHistoryFooter(screen.focusZone);
  usePageFooter({ shortcuts, rightShortcuts });

  useInput((_input, key) => {
    if (key.tab) {
      screen.cycleFocusZone();
    }
  });

  useInput(
    (_input, key) => {
      if (key.escape) {
        screen.setSearchQuery("");
        screen.setFocusZone("runs");
        return;
      }
      if (key.downArrow) {
        screen.setFocusZone("timeline");
        return;
      }
    },
    { isActive: screen.focusZone === "search" },
  );

  useInput(
    (input) => {
      if (input === "/") {
        screen.setFocusZone("search");
      }
      if (input === "o" && screen.selectedRunId) {
        screen.handleRunActivate(screen.selectedRunId);
      }
    },
    { isActive: screen.focusZone !== "search" },
  );

  const sectionsWidth = isMedium
    ? Math.max(Math.floor(columns * 0.18), 16)
    : Math.max(Math.floor(columns * 0.2), 18);
  const insightsWidth = isMedium
    ? Math.max(Math.floor(columns * 0.32), 26)
    : Math.max(Math.floor(columns * 0.34), 30);
  const paneHeight = Math.max(rows - 8, 8);
  const insightScrollHeight = getInsightScrollHeight({ isNarrow, isMedium, paneHeight });

  const guard = guardQueryState(screen.reviewsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Runs</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Spinner label="Loading runs..." />
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Runs</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <Text color={tokens.error}>Error: {err.message}</Text>
            </Box>
          </Box>
        </Panel.Content>
      </Panel>
    ),
  });

  if (guard) return guard;

  if (!screen.hasReviews) {
    return (
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <SectionHeader>Runs</SectionHeader>
            <Box justifyContent="center" paddingY={2}>
              <EmptyState>
                <EmptyState.Message>{screen.emptyRunsMessage}</EmptyState.Message>
                <EmptyState.Description>Run a review to see it here</EmptyState.Description>
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
          <SectionHeader>Runs</SectionHeader>
          <Box>
            <Input
              value={screen.searchQuery}
              onChange={screen.setSearchQuery}
              placeholder={HISTORY_SEARCH_PLACEHOLDER}
              size="lg"
              isActive={screen.focusZone === "search"}
            />
          </Box>
          <Box flexDirection={isNarrow ? "column" : "row"}>
            <Box
              width={isNarrow ? undefined : sectionsWidth}
              borderStyle="single"
              borderColor={screen.focusZone === "timeline" ? tokens.accent : tokens.border}
              flexDirection="column"
            >
              <Box paddingX={1} paddingTop={1}>
                <SectionHeader variant="muted">Sections</SectionHeader>
              </Box>
              <SectionsList
                items={screen.timelineItems}
                selectedId={screen.selectedDateId}
                onSelect={(id) => {
                  screen.setFocusZone("timeline");
                  screen.setSelectedDateId(id);
                }}
                onHighlightChange={screen.setSelectedDateId}
                isActive={screen.focusZone === "timeline"}
              />
            </Box>
            <Box
              flexGrow={1}
              borderStyle="single"
              borderColor={screen.focusZone === "runs" ? tokens.accent : tokens.border}
              flexDirection="column"
            >
              <Box paddingX={1} paddingTop={1}>
                <SectionHeader variant="muted">Runs</SectionHeader>
              </Box>
              <RunsList
                runs={screen.mappedRuns}
                selectedId={screen.selectedRunId}
                onSelect={screen.handleRunActivate}
                onHighlightChange={screen.setSelectedRunId}
                isActive={screen.focusZone === "runs"}
                emptyMessage={screen.emptyRunsMessage}
              />
            </Box>
            <Box
              width={isNarrow ? undefined : insightsWidth}
              borderStyle="single"
              borderColor={screen.focusZone === "insights" ? tokens.accent : tokens.border}
            >
              <HistoryInsightsPane
                runId={screen.selectedRun ? `#${screen.selectedRun.id.slice(0, 4)}` : null}
                severityCounts={screen.hasReviews ? screen.severityCounts : null}
                issues={screen.hasReviews ? screen.sortedIssues : []}
                duration={screen.duration}
                isActive={screen.focusZone === "insights"}
                scrollHeight={insightScrollHeight}
                onIssueClick={screen.handleIssueClick}
              />
            </Box>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
