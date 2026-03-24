import { useState } from "react";
import { Box } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useReviewKeyboard } from "../hooks/use-review-keyboard.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { IssueListPane } from "./issue-list-pane.js";
import { IssueDetailsPane } from "./issue-details-pane.js";

interface Issue {
  id: string;
  severity: string;
  filePath: string;
  title: string;
  description: string;
  code?: string;
  startLine?: number;
  fixPlan?: string;
  category?: string;
}

export interface ReviewResultsViewProps {
  issues: Issue[];
  onBack?: () => void;
}

type Zone = "list" | "details";

export function ReviewResultsView({ issues, onBack }: ReviewResultsViewProps) {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>(
    issues[0]?.id,
  );
  const [activeZone, setActiveZone] = useState<Zone>("list");

  useReviewKeyboard({
    onIssueNav(direction) {
      if (activeZone !== "list" || issues.length === 0) return;
      const currentIndex = issues.findIndex((i) => i.id === selectedIssueId);
      const nextIndex =
        direction === "down"
          ? Math.min(currentIndex + 1, issues.length - 1)
          : Math.max(currentIndex - 1, 0);
      const nextIssue = issues[nextIndex];
      if (nextIssue) {
        setSelectedIssueId(nextIssue.id);
      }
    },
    onZoneSwitch() {
      setActiveZone((z) => (z === "list" ? "details" : "list"));
    },
    onTabSwitch() {
      // Tab switching handled by IssueDetailsPane's Tabs component
    },
    onBack() {
      onBack?.();
    },
  });

  const selectedIssue = issues.find((i) => i.id === selectedIssueId);
  const listWidth = Math.max(Math.floor(columns * 0.4), 30);

  return (
    <Box flexDirection="column">
      <SectionHeader bordered>
        {`Review Results (${issues.length} issues)`}
      </SectionHeader>
      <Box flexDirection="row" marginTop={1}>
        <Box
          width={listWidth}
          borderStyle="single"
          borderColor={activeZone === "list" ? tokens.accent : tokens.border}
        >
          <IssueListPane
            issues={issues}
            selectedId={selectedIssueId}
            onSelect={setSelectedIssueId}
            onHighlightChange={setSelectedIssueId}
            isActive={activeZone === "list"}
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
          />
        </Box>
      </Box>
    </Box>
  );
}
