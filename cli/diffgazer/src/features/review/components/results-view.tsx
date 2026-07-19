import { usePageFooter } from "@diffgazer/core/footer";
import {
  buildDuplicateCollapseNotice,
  filterIssuesBySeverity,
  formatRunId,
  selectDetailsEmptyKind,
  useIssueDetailsState,
} from "@diffgazer/core/review";
import type { Shortcut, UISeverityFilter } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT, SWITCH_PANE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { type ReactElement, useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { useReviewKeyboard } from "../hooks/use-keyboard";
import { IssueDetailsPane, type IssueDetailsSubZone } from "./issue-details-pane";
import { IssueListPane, type IssueListSubZone } from "./issue-list-pane";

export interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId?: string | null;
  initialIssueId?: string;
  droppedDuplicates?: number;
  onBack?: () => void;
}

type Zone = "list" | "details";

const RESULTS_SHORTCUTS_LEFT: Shortcut[] = [
  { key: "j/k", label: "Navigate" },
  SWITCH_PANE_SHORTCUT,
];
const RESULTS_SHORTCUTS_RIGHT: Shortcut[] = [BACK_SHORTCUT];
const RESULTS_CHROME_ROWS = 2;
const RESULTS_PANE_BORDER_ROWS = 2;
const ISSUE_LIST_CHROME_ROWS = 5;
const ISSUE_DETAILS_CHROME_ROWS = 7;
// Narrow mode truncates the details title and location to one row each, so the
// half-pane chrome is exact: paddingTop + title + location.
const NARROW_DETAILS_HEADER_ROWS = 3;
const DETAILS_TABS_ROWS = 2;

export function ReviewResultsView({
  issues,
  reviewId,
  initialIssueId,
  droppedDuplicates,
  onBack,
}: ReviewResultsViewProps): ReactElement {
  const { tokens } = useTheme();
  const { columns, isNarrow, isMedium } = useResponsive();
  const { contentRows } = useContentZone();
  const [severityFilter, setSeverityFilter] = useState<UISeverityFilter>(() => new Set());
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(() =>
    initialIssueId && issues.some((issue) => issue.id === initialIssueId)
      ? initialIssueId
      : issues[0]?.id,
  );
  const [activeZone, setActiveZone] = useState<Zone>("list");
  const [listSubZone, setListSubZone] = useState<IssueListSubZone>("issues");
  const [detailsSubZone, setDetailsSubZone] = useState<IssueDetailsSubZone>("body");

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);
  const firstVisibleIssue = filteredIssues[0];
  if (firstVisibleIssue && !filteredIssues.some((issue) => issue.id === selectedIssueId)) {
    setSelectedIssueId(firstVisibleIssue.id);
  }
  const selectedIssue = filteredIssues.find((i) => i.id === selectedIssueId);
  const { activeTab, availableTabs, setActiveTab, completedSteps, toggleStep } =
    useIssueDetailsState(selectedIssue);
  const visibleTabs = selectedIssue ? availableTabs : [];
  const canFocusFixPlan = activeTab === "details" && Boolean(selectedIssue?.fixPlan?.length);
  const effectiveDetailsSubZone = canFocusFixPlan ? detailsSubZone : "body";

  const shortcuts =
    visibleTabs.length === 0
      ? RESULTS_SHORTCUTS_LEFT
      : [...RESULTS_SHORTCUTS_LEFT, { key: `1-${visibleTabs.length}`, label: "Tabs" }];
  usePageFooter({ shortcuts, rightShortcuts: onBack ? RESULTS_SHORTCUTS_RIGHT : [] });

  useReviewKeyboard({
    onZoneSwitch() {
      if (activeZone === "list") {
        setDetailsSubZone("body");
        setActiveZone("details");
        return;
      }

      if (canFocusFixPlan && effectiveDetailsSubZone === "body") {
        setDetailsSubZone("fix-plan");
        return;
      }

      setDetailsSubZone("body");
      setActiveZone("list");
    },
    onTabSwitch(tabNumber) {
      const tab = visibleTabs[tabNumber - 1];
      if (!tab) return;
      setDetailsSubZone("body");
      setActiveTab(tab);
    },
    onBack() {
      onBack?.();
    },
  });

  const detailsEmptyKind = selectDetailsEmptyKind(issues.length, filteredIssues.length);
  const duplicateNotice = buildDuplicateCollapseNotice(droppedDuplicates, issues.length);
  const listWidth = isMedium
    ? Math.max(Math.floor(columns * 0.35), 26)
    : Math.max(Math.floor(columns * 0.4), 30);
  const listContentWidth = Math.max((isNarrow ? columns : listWidth) - 4, 1);
  const duplicateNoticeRows = duplicateNotice ? 1 : 0;
  const paneHeight = Math.max(contentRows - RESULTS_CHROME_ROWS - duplicateNoticeRows, 1);
  const paneContentHeight = Math.max(paneHeight - RESULTS_PANE_BORDER_ROWS, 1);
  const listPaneContentHeight = isNarrow
    ? Math.max(Math.floor(paneContentHeight / 2), 1)
    : paneContentHeight;
  const listScrollHeight = Math.max(listPaneContentHeight - ISSUE_LIST_CHROME_ROWS, 1);
  const detailsPaneHeight = Math.floor(paneHeight / 2);
  const narrowDetailsInnerRows = Math.max(detailsPaneHeight - RESULTS_PANE_BORDER_ROWS, 0);
  const showDetailsTabs =
    !isNarrow || narrowDetailsInnerRows >= NARROW_DETAILS_HEADER_ROWS + DETAILS_TABS_ROWS + 1;
  const detailScrollHeight = isNarrow
    ? Math.max(
        narrowDetailsInnerRows -
          NARROW_DETAILS_HEADER_ROWS -
          (showDetailsTabs ? DETAILS_TABS_ROWS : 0),
        1,
      )
    : Math.max(paneContentHeight - ISSUE_DETAILS_CHROME_ROWS, 1);
  const reviewIdLabel = reviewId ? formatRunId(reviewId) : "#unknown";

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text color={tokens.accent} bold>
          {`Review ${reviewIdLabel}`}
        </Text>
      </Box>
      {duplicateNotice ? (
        <Box paddingX={1}>
          <Text color={tokens.muted}>{duplicateNotice}</Text>
        </Box>
      ) : null}
      <Box flexDirection={isNarrow ? "column" : "row"} marginTop={1}>
        <Box
          width={isNarrow ? undefined : listWidth}
          height={isNarrow ? Math.ceil(paneHeight / 2) : paneHeight}
          flexShrink={isNarrow ? undefined : 0}
          overflowY="hidden"
          borderStyle="single"
          borderColor={activeZone === "list" ? tokens.accent : tokens.border}
        >
          <IssueListPane
            issues={filteredIssues}
            allIssues={issues}
            selectedId={selectedIssueId}
            onHighlightChange={setSelectedIssueId}
            isActive={activeZone === "list"}
            height={listScrollHeight}
            contentWidth={listContentWidth}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            subZone={listSubZone}
            onSubZoneChange={setListSubZone}
          />
        </Box>
        <Box
          flexGrow={1}
          height={isNarrow ? detailsPaneHeight : paneHeight}
          overflowY="hidden"
          borderStyle="single"
          borderColor={activeZone === "details" ? tokens.accent : tokens.border}
        >
          <IssueDetailsPane
            issue={selectedIssue}
            isActive={activeZone === "details"}
            scrollHeight={detailScrollHeight}
            emptyKind={detailsEmptyKind}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            completedSteps={completedSteps}
            onToggleStep={toggleStep}
            subZone={effectiveDetailsSubZone}
            truncateHeader={isNarrow}
            showTabs={showDetailsTabs}
          />
        </Box>
      </Box>
    </Box>
  );
}
