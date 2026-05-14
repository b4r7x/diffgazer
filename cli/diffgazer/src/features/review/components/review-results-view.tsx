import { useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { UISeverityFilter, Shortcut } from "@diffgazer/core/schemas/ui";
import {
  filterIssuesBySeverity,
  selectDetailsEmptyKind,
} from "@diffgazer/core/review";
import { useTheme } from "../../../theme/theme-context.js";
import { useResponsive } from "../../../hooks/use-terminal-dimensions.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { useReviewKeyboard } from "../hooks/use-review-keyboard.js";
import { IssueListPane } from "./issue-list-pane.js";
import { IssueDetailsPane } from "./issue-details-pane.js";

export interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  reviewId?: string | null;
  onBack?: () => void;
}

type Zone = "list" | "details";

const RESULTS_SHORTCUTS_LEFT: Shortcut[] = [
  { key: "j/k", label: "Navigate" },
  { key: "Tab", label: "Switch Pane" },
  { key: "1-4", label: "Tabs" },
];
const RESULTS_SHORTCUTS_RIGHT: Shortcut[] = [{ key: "Esc", label: "Back" }];

export function ReviewResultsView({
  issues,
  reviewId,
  onBack,
}: ReviewResultsViewProps): ReactElement {
  const { tokens } = useTheme();
  const { columns, rows, isNarrow, isMedium } = useResponsive();
  const [severityFilter, setSeverityFilter] =
    useState<UISeverityFilter>("all");
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(
    issues[0]?.id,
  );
  const [activeZone, setActiveZone] = useState<Zone>("list");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    () => new Set(),
  );
  const [lastIssueId, setLastIssueId] = useState<string | undefined>(
    issues[0]?.id,
  );

  usePageFooter({
    shortcuts: RESULTS_SHORTCUTS_LEFT,
    rightShortcuts: onBack ? RESULTS_SHORTCUTS_RIGHT : [],
  });

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);

  if (selectedIssueId !== lastIssueId) {
    setLastIssueId(selectedIssueId);
    setCompletedSteps(new Set());
  }

  useReviewKeyboard({
    onIssueNav(direction) {
      if (activeZone !== "list" || filteredIssues.length === 0) return;
      const currentIndex = filteredIssues.findIndex(
        (i) => i.id === selectedIssueId,
      );
      const nextIndex =
        direction === "down"
          ? Math.min(currentIndex + 1, filteredIssues.length - 1)
          : Math.max(currentIndex - 1, 0);
      const nextIssue = filteredIssues[nextIndex];
      if (nextIssue) {
        setSelectedIssueId(nextIssue.id);
      }
    },
    onZoneSwitch() {
      setActiveZone((z) => (z === "list" ? "details" : "list"));
    },
    onBack() {
      onBack?.();
    },
  });

  const handleToggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const selectedIssue = filteredIssues.find((i) => i.id === selectedIssueId);
  const detailsEmptyKind = selectDetailsEmptyKind(
    issues.length,
    filteredIssues.length,
  );
  const listWidth = isMedium
    ? Math.max(Math.floor(columns * 0.35), 26)
    : Math.max(Math.floor(columns * 0.4), 30);
  const paneHeight = Math.max(rows - 8, 8);
  const listScrollHeight = isNarrow
    ? Math.max(Math.floor(paneHeight / 2), 6)
    : paneHeight;
  const detailScrollHeight = isNarrow
    ? Math.max(Math.floor(paneHeight / 2), 6)
    : paneHeight;

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text color={tokens.accent} bold>
          {`Analysis #${reviewId ?? "unknown"}`}
        </Text>
      </Box>
      <Box
        flexDirection={isNarrow ? "column" : "row"}
        marginTop={1}
      >
        <Box
          width={isNarrow ? undefined : listWidth}
          borderStyle="single"
          borderColor={
            activeZone === "list" ? tokens.accent : tokens.border
          }
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
          />
        </Box>
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor={
            activeZone === "details" ? tokens.accent : tokens.border
          }
        >
          <IssueDetailsPane
            issue={selectedIssue}
            isActive={activeZone === "details"}
            scrollHeight={detailScrollHeight}
            emptyKind={detailsEmptyKind}
            completedSteps={completedSteps}
            onToggleStep={handleToggleStep}
          />
        </Box>
      </Box>
    </Box>
  );
}
