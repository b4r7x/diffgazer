import { usePageFooter } from "@diffgazer/core/footer";
import {
  filterIssuesBySeverity,
  selectDetailsEmptyKind,
  useIssueDetailsState,
} from "@diffgazer/core/review";
import type { Shortcut, UISeverityFilter } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT, SWITCH_PANE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { type ReactElement, useState } from "react";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { useReviewKeyboard } from "../hooks/use-keyboard";
import { IssueDetailsPane, type IssueDetailsSubZone } from "./issue-details-pane";
import { IssueListPane, type IssueListSubZone } from "./issue-list-pane";

export interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId?: string | null;
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
  onBack,
}: ReviewResultsViewProps): ReactElement {
  const { tokens } = useTheme();
  const { columns, rows, isNarrow, isMedium } = useResponsive();
  const [severityFilter, setSeverityFilter] = useState<UISeverityFilter>(() => new Set());
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(issues[0]?.id);
  const [activeZone, setActiveZone] = useState<Zone>("list");
  const [listSubZone, setListSubZone] = useState<IssueListSubZone>("issues");
  const [detailsSubZone, setDetailsSubZone] = useState<IssueDetailsSubZone>("body");

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);
  const selectedIssue = filteredIssues.find((i) => i.id === selectedIssueId);
  const { activeTab, availableTabs, setActiveTab, completedSteps, toggleStep } =
    useIssueDetailsState(selectedIssue);
  const canFocusFixPlan = activeTab === "details" && Boolean(selectedIssue?.fixPlan?.length);
  const effectiveDetailsSubZone = canFocusFixPlan ? detailsSubZone : "body";

  usePageFooter({
    shortcuts: [...RESULTS_SHORTCUTS_LEFT, { key: `1-${availableTabs.length}`, label: "Tabs" }],
    rightShortcuts: onBack ? RESULTS_SHORTCUTS_RIGHT : [],
  });

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
      const tab = availableTabs[tabNumber - 1];
      if (!tab) return;
      setDetailsSubZone("body");
      setActiveTab(tab);
    },
    onBack() {
      onBack?.();
    },
  });

  const detailsEmptyKind = selectDetailsEmptyKind(issues.length, filteredIssues.length);
  const listWidth = isMedium
    ? Math.max(Math.floor(columns * 0.35), 26)
    : Math.max(Math.floor(columns * 0.4), 30);
  const paneHeight = Math.max(rows - 8, 8);
  const listScrollHeight = isNarrow ? Math.max(Math.floor(paneHeight / 2), 6) : paneHeight;
  const detailScrollHeight = isNarrow ? Math.max(Math.floor(paneHeight / 2), 6) : paneHeight;
  const reviewIdLabel = reviewId == null ? "#unknown" : `#${reviewId}`;

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text color={tokens.accent} bold>
          {`Review ${reviewIdLabel}`}
        </Text>
      </Box>
      <Box flexDirection={isNarrow ? "column" : "row"} marginTop={1}>
        <Box
          width={isNarrow ? undefined : listWidth}
          borderStyle="single"
          borderColor={activeZone === "list" ? tokens.accent : tokens.border}
        >
          <IssueListPane
            issues={filteredIssues}
            allIssues={issues}
            selectedId={selectedIssueId}
            onSelect={setSelectedIssueId}
            onHighlightChange={setSelectedIssueId}
            isActive={activeZone === "list"}
            height={listScrollHeight}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            subZone={listSubZone}
            onSubZoneChange={setListSubZone}
          />
        </Box>
        <Box
          flexGrow={1}
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
          />
        </Box>
      </Box>
    </Box>
  );
}
