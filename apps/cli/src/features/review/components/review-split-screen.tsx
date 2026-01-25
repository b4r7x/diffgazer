import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useStdout } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { SplitPane } from "../../../components/ui/split-pane.js";
import { Separator } from "../../../components/ui/separator.js";
import { FooterBar, type ModeShortcuts } from "../../../components/ui/footer-bar.js";
import { IssueListPane } from "./issue-list-pane.js";
import { IssueDetailsPane } from "./issue-details-pane.js";
import { AgentActivityPanel } from "./agent-activity-panel.js";
import { type IssueTab } from "./issue-tabs.js";
import { useReviewKeyboard, type FocusArea } from "../hooks/use-review-keyboard.js";
import { useAgentActivity } from "../hooks/use-agent-activity.js";

const AGENT_PANEL_WIDTH = 28;

interface ReviewSplitScreenProps {
  issues: TriageIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  onApplyPatch: (id: string) => void;
  onIgnoreIssue: (id: string) => void;
  onDrilldown: (id: string) => void;
  onBack: () => void;
  drilldownData?: DrilldownResult | null;
  title?: string;
  agentEvents?: AgentStreamEvent[];
  isReviewing?: boolean;
  showAgentPanel?: boolean;
}

export function ReviewSplitScreen({
  issues,
  selectedIssueId,
  onSelectIssue,
  onApplyPatch,
  onIgnoreIssue,
  onDrilldown,
  onBack,
  drilldownData,
  title = "Review",
  agentEvents = [],
  isReviewing = false,
  showAgentPanel: showAgentPanelProp,
}: ReviewSplitScreenProps): ReactElement {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const listPaneHeight = Math.max(10, terminalHeight - 10);

  const { agents, currentAction } = useAgentActivity(agentEvents);

  // Use explicit prop if provided, otherwise fall back to automatic detection
  const showAgentPanel =
    showAgentPanelProp !== undefined
      ? showAgentPanelProp
      : isReviewing && agents.length > 0;

  const selectedIndex = (() => {
    if (!selectedIssueId) return 0;
    const idx = issues.findIndex((issue) => issue.id === selectedIssueId);
    return idx >= 0 ? idx : 0;
  })();

  const [activeTab, setActiveTab] = useState<IssueTab>("details");
  const [focus, setFocus] = useState<FocusArea>("list");
  const [isApplying, setIsApplying] = useState(false);

  const selectedIssue = issues[selectedIndex] ?? null;

  const handleNavigate = (direction: "up" | "down") => {
    const delta = direction === "down" ? 1 : -1;
    const newIndex = Math.max(0, Math.min(selectedIndex + delta, issues.length - 1));
    const issue = issues[newIndex];
    if (issue) {
      onSelectIssue(issue.id);
    }
  };

  const handleOpen = () => {
    setFocus("details");
  };

  const handleApply = () => {
    if (isApplying || !selectedIssue) return;
    setIsApplying(true);
    onApplyPatch(selectedIssue.id);
    setIsApplying(false);
  };

  const handleApplyFromDetails = (issue: TriageIssue) => {
    if (isApplying) return;
    setIsApplying(true);
    onApplyPatch(issue.id);
    setIsApplying(false);
  };

  const handleIgnore = () => {
    if (selectedIssue) {
      onIgnoreIssue(selectedIssue.id);
    }
  };

  const handleExplain = () => {
    if (selectedIssue) {
      onDrilldown(selectedIssue.id);
    }
  };

  const handleTrace = () => {
    setActiveTab("trace");
  };

  const handleNextIssue = () => {
    handleNavigate("down");
  };

  const handlePrevIssue = () => {
    handleNavigate("up");
  };

  const handleToggleFocus = () => {
    setFocus((prev) => (prev === "list" ? "details" : "list"));
  };

  const handleBack = () => {
    if (focus === "details") {
      setFocus("list");
    } else {
      onBack();
    }
  };

  const handleTabChange = (tab: IssueTab) => {
    setActiveTab(tab);
  };

  useReviewKeyboard({
    focus,
    state: {
      focus,
      activeTab,
      hasPatch: Boolean(selectedIssue?.suggested_patch),
      hasTrace: Boolean(selectedIssue?.trace?.length),
    },
    actions: {
      onNavigate: handleNavigate,
      onOpen: handleOpen,
      onApply: handleApply,
      onIgnore: handleIgnore,
      onExplain: handleExplain,
      onTrace: handleTrace,
      onNextIssue: handleNextIssue,
      onPrevIssue: handlePrevIssue,
      onToggleFocus: handleToggleFocus,
      onBack: handleBack,
      onTabChange: handleTabChange,
    },
    disabled: false,
  });

  const footerModeShortcuts: ModeShortcuts = {
    keys: [
      { key: "j/k", label: "Move" },
      { key: "e", label: "Explain" },
      { key: "/", label: "Command" },
      { key: "f", label: "Focus" },
      { key: "?", label: "Help" },
    ],
    menu: [
      { key: "Up/Down", label: "Move" },
      { key: "Enter", label: "Select" },
      { key: "Esc", label: "Back" },
    ],
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Text dimColor> ({issues.length} issues)</Text>
      </Box>

      <Separator />

      <Box marginTop={1} flexGrow={1} flexDirection="row" gap={1}>
        {showAgentPanel && (
          <Box flexDirection="column" width={AGENT_PANEL_WIDTH} flexShrink={0}>
            <AgentActivityPanel
              agents={agents}
              currentAction={currentAction}
              height={listPaneHeight}
            />
          </Box>
        )}
        <Box flexGrow={1}>
          <SplitPane leftWidth={showAgentPanel ? 35 : 40}>
            <IssueListPane
              issues={issues}
              selectedId={selectedIssueId}
              onSelect={onSelectIssue}
              focus={focus === "list"}
              height={listPaneHeight}
            />
            <IssueDetailsPane
              issue={selectedIssue}
              activeTab={activeTab}
              onApplyPatch={handleApplyFromDetails}
              isApplying={isApplying}
              focus={focus === "details"}
              drilldown={drilldownData}
            />
          </SplitPane>
        </Box>
      </Box>

      <Box marginTop={1}>
        <FooterBar modeShortcuts={footerModeShortcuts} />
      </Box>
    </Box>
  );
}
