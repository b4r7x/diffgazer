import { useState } from "react";
import { Box } from "ink";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import type { UISeverityFilter } from "@diffgazer/schemas/ui";
import { filterIssuesBySeverity } from "@diffgazer/core/review";
import { useTheme } from "../../../theme/theme-context.js";
import { useResponsive } from "../../../hooks/use-terminal-dimensions.js";
import { useReviewKeyboard } from "../hooks/use-review-keyboard.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { IssueListPane } from "./issue-list-pane.js";
import { IssueDetailsPane } from "./issue-details-pane.js";

export interface ReviewResultsViewProps {
  issues: ReviewIssue[];
  onBack?: () => void;
}

type Zone = "list" | "details";

export function ReviewResultsView({ issues, onBack }: ReviewResultsViewProps) {
  const { tokens } = useTheme();
  const { columns, rows, isNarrow } = useResponsive();
  const [severityFilter, setSeverityFilter] =
    useState<UISeverityFilter>("all");
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(
    issues[0]?.id,
  );
  const [activeZone, setActiveZone] = useState<Zone>("list");

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);

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

  const selectedIssue = filteredIssues.find((i) => i.id === selectedIssueId);
  const listWidth = Math.max(Math.floor(columns * 0.4), 30);
  const paneHeight = Math.max(rows - 6, 8);
  const listScrollHeight = isNarrow ? Math.max(Math.floor(paneHeight / 2), 6) : paneHeight;
  const detailScrollHeight = isNarrow ? Math.max(Math.floor(paneHeight / 2), 6) : paneHeight;

  return (
    <Box flexDirection="column">
      <SectionHeader bordered>
        {`Review Results (${issues.length} issues)`}
      </SectionHeader>
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
          />
        </Box>
      </Box>
    </Box>
  );
}
