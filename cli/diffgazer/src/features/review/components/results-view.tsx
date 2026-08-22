import { usePageFooter } from "@diffgazer/core/footer";
import { formatRunId } from "@diffgazer/core/format";
import {
  buildDuplicateCollapseNotice,
  buildLensFailureNotice,
  describeTerminalOutcome,
  type FailedTerminalOutcome,
  filterIssuesBySeverity,
  selectDetailsEmptyKind,
  useIssueDetailsState,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { Shortcut, UISeverityFilter } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT, SWITCH_PANE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { type ReactElement, useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { paneBorder } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { useReviewKeyboard } from "../hooks/use-keyboard";
import { computePaneGeometry } from "../lib/pane-geometry";
import { IssueDetailsPane, type IssueDetailsSubZone } from "./issue-details-pane/pane";
import { IssueListPane, type IssueListSubZone } from "./issue-list-pane";

export interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId?: string | null;
  initialIssueId?: string;
  droppedDuplicates?: number;
  lensStats?: LensStat[];
  /** Set when the run ended on a failed outcome; a deep link opens here without passing the summary. */
  terminalOutcome?: FailedTerminalOutcome;
  onBack?: () => void;
}

type Zone = "list" | "details";

const RESULTS_SHORTCUTS_LEFT: Shortcut[] = [
  { key: "j/k", label: "Navigate" },
  SWITCH_PANE_SHORTCUT,
];
const RESULTS_SHORTCUTS_RIGHT: Shortcut[] = [BACK_SHORTCUT];

export function ReviewResultsView({
  issues,
  reviewId,
  initialIssueId,
  droppedDuplicates,
  lensStats,
  terminalOutcome,
  onBack,
}: ReviewResultsViewProps): ReactElement {
  const { tokens } = useTheme();
  const { columns, isNarrow } = useResponsive();
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
  const completenessNotice = buildLensFailureNotice(lensStats);
  // A findings deep link opens this screen without passing the summary, so the
  // outcome that stopped the run is told here too: on its own the completeness
  // notice reads as "a lens errored", never "the run ended".
  const failure = terminalOutcome ? describeTerminalOutcome(terminalOutcome) : null;
  const noticeRows = (failure ? 1 : 0) + (duplicateNotice ? 1 : 0) + (completenessNotice ? 1 : 0);
  const {
    listWidth,
    listContentWidth,
    listPaneHeight,
    detailsPaneHeight,
    listScrollHeight,
    detailScrollHeight,
    showDetailsTabs,
  } = computePaneGeometry({
    columns,
    contentRows,
    isNarrow,
    noticeRows,
  });
  const reviewIdLabel = reviewId ? formatRunId(reviewId) : "#unknown";

  return (
    <Box flexDirection="column" width="100%">
      <Box paddingX={1}>
        <Text color={tokens.accent} bold>
          {`Review ${reviewIdLabel}`}
        </Text>
      </Box>
      {failure ? (
        <Box paddingX={1}>
          <Text color={tokens.error}>{`${failure.title} — ${failure.message}`}</Text>
        </Box>
      ) : null}
      {completenessNotice ? (
        <Box paddingX={1}>
          <Text color={tokens.warning}>{completenessNotice}</Text>
        </Box>
      ) : null}
      {duplicateNotice ? (
        <Box paddingX={1}>
          <Text color={tokens.muted}>{duplicateNotice}</Text>
        </Box>
      ) : null}
      <Box flexDirection={isNarrow ? "column" : "row"} marginTop={1}>
        <Box
          width={isNarrow ? undefined : listWidth}
          height={listPaneHeight}
          flexShrink={isNarrow ? undefined : 0}
          overflowY="hidden"
          {...paneBorder(tokens, activeZone === "list")}
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
          width={isNarrow ? undefined : Math.max(columns - listWidth, 1)}
          flexGrow={isNarrow ? 1 : 0}
          minWidth={0}
          height={detailsPaneHeight}
          overflowY="hidden"
          {...paneBorder(tokens, activeZone === "details")}
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
