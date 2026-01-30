import { useState, useMemo, useCallback } from "react";
import type { ReactElement } from "react";
import { Box, Text, useStdout } from "ink";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { SplitPane } from "../../../components/ui/split-pane.js";
import { Separator } from "../../../components/ui/separator.js";
import { FooterBar, type ModeShortcuts } from "../../../components/ui/footer-bar.js";
import { type SeverityFilter, SEVERITY_ORDER } from "../../../components/ui/severity-filter-group.js";
import { IssueListPane } from "./issue-list-pane.js";
import { IssueDetailsPane } from "./issue-details-pane.js";
import { AgentActivityPanel } from "./agent-activity-panel.js";
import { type IssueTab, AGENT_PANEL_WIDTH } from "../constants.js";
import { useReviewKeyboard, type FocusArea } from "../hooks/use-review-keyboard.js";
import { useAgentActivity } from "../hooks/use-agent-activity.js";

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

  const [activeTab, setActiveTab] = useState<IssueTab>("details");
  const [focus, setFocus] = useState<FocusArea>("list");
  const [filterFocusedIndex, setFilterFocusedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<SeverityFilter>("all");

  const filteredIssues = useMemo(
    () => activeFilter === "all" ? issues : issues.filter((issue) => issue.severity === activeFilter),
    [issues, activeFilter]
  );

  const selectedIndex = useMemo(() => {
    if (!selectedIssueId) return 0;
    const idx = filteredIssues.findIndex((issue) => issue.id === selectedIssueId);
    return idx >= 0 ? idx : 0;
  }, [selectedIssueId, filteredIssues]);

  const selectedIssue = filteredIssues[selectedIndex] ?? null;

  const handleNavigate = useCallback((direction: "up" | "down") => {
    const delta = direction === "down" ? 1 : -1;
    const newIndex = Math.max(0, Math.min(selectedIndex + delta, filteredIssues.length - 1));
    const issue = filteredIssues[newIndex];
    if (issue) {
      onSelectIssue(issue.id);
    }
  }, [selectedIndex, filteredIssues, onSelectIssue]);

  const handleOpen = () => {
    setFocus("details");
  };

  const handleApply = () => {
    if (!selectedIssue) return;
    onApplyPatch(selectedIssue.id);
  };

  const handleApplyFromDetails = (issue: TriageIssue) => {
    onApplyPatch(issue.id);
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
    setFocus((prev) => {
      if (prev === "filters") return "list";
      if (prev === "list") return "details";
      return "filters";
    });
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

  const handleFilterNavigate = (direction: "left" | "right") => {
    setFilterFocusedIndex((i) => {
      const delta = direction === "right" ? 1 : -1;
      const newIndex = i + delta;
      return Math.max(0, Math.min(newIndex, SEVERITY_ORDER.length - 1));
    });
  };

  const handleFilterSelect = () => {
    const selectedSeverity = SEVERITY_ORDER[filterFocusedIndex];
    if (selectedSeverity) {
      setActiveFilter((current) => current === selectedSeverity ? "all" : selectedSeverity);
    }
  };

  const handleFocusFilters = () => {
    setFocus("filters");
  };

  useReviewKeyboard({
    focus,
    state: {
      focus,
      activeTab,
      hasPatch: Boolean(selectedIssue?.suggested_patch),
      hasTrace: Boolean(selectedIssue?.trace?.length),
      filterFocusedIndex,
      filterCount: SEVERITY_ORDER.length,
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
      onFilterNavigate: handleFilterNavigate,
      onFilterSelect: handleFilterSelect,
      onFocusFilters: handleFocusFilters,
    },
    disabled: false,
  });

  const footerModeShortcuts: ModeShortcuts = {
    keys: [
      { key: "j/k", label: "Move" },
      { key: "f", label: "Filters" },
      { key: "1-4", label: "Tab" },
      { key: "e", label: "Explain" },
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
        <Text dimColor> ({filteredIssues.length} issues{activeFilter !== "all" ? ` - ${activeFilter}` : ""})</Text>
      </Box>

      <Separator />

      <Box marginTop={1} flexGrow={1} flexDirection="column">
        <Box flexGrow={1} flexDirection="row" gap={1}>
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
                issues={filteredIssues}
                allIssues={issues}
                selectedId={selectedIssueId}
                onSelect={onSelectIssue}
                focus={focus === "list"}
                height={listPaneHeight}
                title={title}
                severityFilter={activeFilter}
                onSeverityFilterChange={setActiveFilter}
                isFilterFocused={focus === "filters"}
                focusedFilterIndex={filterFocusedIndex}
              />
              <IssueDetailsPane
                issue={selectedIssue}
                activeTab={activeTab}
                onApplyPatch={handleApplyFromDetails}
                isApplying={false}
                focus={focus === "details"}
                drilldown={drilldownData}
              />
            </SplitPane>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1}>
        <FooterBar modeShortcuts={footerModeShortcuts} />
      </Box>
    </Box>
  );
}
