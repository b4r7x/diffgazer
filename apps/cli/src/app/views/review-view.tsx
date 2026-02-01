import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Box, Text, useApp, useStdout, useInput } from "ink";
import Spinner from "ink-spinner";
import { truncate } from "@repo/core";
import { getSuggestionReason } from "../../lib/drilldown-suggester.js";
import { useScreenState } from "../../hooks/use-screen-state.js";
import type { TriageState } from "../../features/review/index.js";
import type { TriageIssue } from "@repo/schemas/triage";
import type { SavedTriageReview } from "@repo/schemas/triage-storage";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { SplitPane } from "../../components/ui/layout/index.js";
import { Separator } from "../../components/ui/separator.js";
import { FooterBar, type Shortcut, type ModeShortcuts } from "../../components/ui/branding/footer-bar.js";
import { SEVERITY_ORDER } from "@repo/schemas/ui";
import { SeverityFilterGroup } from "../../components/ui/severity/index.js";
import {
  IssueListPane,
  IssueDetailsPane,
  FeedbackInput,
  AGENT_PANEL_WIDTH,
  type IssueTab,
} from "../../features/review/components/index.js";
import { DrilldownPrompt } from "../../features/review/components/drilldown-prompt.js";
import { AgentActivityPanel } from "../../features/review/components/agent-activity-panel.js";
import { ReviewSummaryView } from "../../features/review/components/index.js";
import { useAgentActivity } from "@repo/hooks";
import {
  useReviewKeyboard,
  useDrilldownState,
  useIssueFiltering,
  useReviewHandlers,
  type FocusArea,
} from "../../features/review/hooks/index.js";
import { useSessionRecorderContext } from "../../hooks/index.js";

interface ReviewViewProps {
  state: TriageState;
  staged: boolean;
  reviewId?: string;
  agentEvents?: AgentStreamEvent[];
  currentReview?: SavedTriageReview | null;
}

function LoadingDisplay({
  content,
  staged,
  agentEvents = [],
}: {
  content: string;
  staged: boolean;
  agentEvents?: AgentStreamEvent[];
}) {
  const { agents, currentAction } = useAgentActivity(agentEvents);
  const showAgentPanel = agents.length > 0;

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column">
          <Box>
            <Spinner type="dots" />
            <Text> Reviewing {staged ? "staged" : "unstaged"} changes...</Text>
          </Box>
          {content && <Text dimColor>{truncate(content, 200)}</Text>}
        </Box>
        {showAgentPanel && (
          <Box flexShrink={0} width={AGENT_PANEL_WIDTH}>
            <AgentActivityPanel
              agents={agents}
              currentAction={currentAction}
              height={10}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ErrorDisplay({ message }: { message: string }) {
  return <Text color="red">Error: {message}</Text>;
}

function IdleDisplay() {
  return <Text dimColor>Press 'r' to start review</Text>;
}

const EMPTY_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "b", label: "Back" },
  { key: "q", label: "Quit" },
];

function ReviewSplitScreenView({
  issues,
  summary,
  overallScore,
  staged,
  reviewId,
  onBack,
  agentEvents = [],
  showAgentPanel = false,
}: {
  issues: TriageIssue[];
  summary: string;
  overallScore: number | null | undefined;
  staged: boolean;
  reviewId?: string;
  onBack: () => void;
  agentEvents?: AgentStreamEvent[];
  showAgentPanel?: boolean;
}) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const listPaneHeight = Math.max(10, terminalHeight - 12);

  const [selectedId, setSelectedId] = useScreenState<string | null>("selectedId", issues[0]?.id ?? null);
  const [activeTab, setActiveTab] = useScreenState<IssueTab>("activeTab", "details");
  const [focus, setFocus] = useScreenState<FocusArea>("focus", "list");
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [askResponse, setAskResponse] = useState<string | null>(null);

  const { recordEvent } = useSessionRecorderContext();

  const { agents, currentAction } = useAgentActivity(agentEvents);
  const shouldShowAgentPanel = showAgentPanel && agents.length > 0;

  const {
    drilldownState,
    showingDrilldownPrompt,
    currentDrilldownIssue,
    getCachedDrilldown,
    triggerDrilldownForIssue,
    handleDrilldownAccept,
    handleDrilldownSkip,
    handleDrilldownAcceptAll,
    pendingDrilldowns,
  } = useDrilldownState({ issues, reviewId });

  const {
    filteredIssues,
    severityCounts,
    severityFilter,
    setSeverityFilter,
    activeFilter,
    setActiveFilter,
    addIgnoredPattern,
    filterFocusedIndex,
    handleFilterNavigate,
    handleFilterSelect,
    filterInfo,
  } = useIssueFiltering({ issues });

  const selectedIndex = useMemo(() => {
    if (!selectedId) return 0;
    const idx = filteredIssues.findIndex((issue) => issue.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [filteredIssues, selectedId]);

  const selectedIssue = filteredIssues[selectedIndex] ?? null;

  // Record issue open events when selection changes
  const prevSelectedIdRef = useRef(selectedId);
  useEffect(() => {
    if (prevSelectedIdRef.current !== selectedId && selectedId) {
      const issue = filteredIssues.find((i) => i.id === selectedId);
      if (issue) {
        recordEvent("OPEN_ISSUE", {
          issueId: issue.id,
          title: issue.title,
          severity: issue.severity,
          file: issue.file,
        });
      }
      prevSelectedIdRef.current = selectedId;
    }
  }, [selectedId, filteredIssues, recordEvent]);

  const handlers = useReviewHandlers({
    selectedIssue,
    selectedIndex,
    filteredIssues,
    focus,
    reviewId,
    setSelectedId,
    setActiveTab,
    setFocus,
    setFeedbackMode,
    setAskResponse,
    setActiveFilter,
    addIgnoredPattern,
    handleFilterNavigate,
    handleFilterSelect,
    triggerDrilldownForIssue,
    onBack,
    recordEvent,
  });

  useInput(
    (input) => {
      if (feedbackMode || showingDrilldownPrompt) return;
      if (input === "/" || input === ":") setFeedbackMode(true);
    },
    { isActive: !feedbackMode && !showingDrilldownPrompt }
  );

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
      onNavigate: handlers.handleNavigate,
      onOpen: handlers.handleOpen,
      onApply: handlers.handleApply,
      onIgnore: handlers.handleIgnore,
      onExplain: handlers.handleExplain,
      onTrace: handlers.handleTrace,
      onNextIssue: handlers.handleNextIssue,
      onPrevIssue: handlers.handlePrevIssue,
      onToggleFocus: handlers.handleToggleFocus,
      onBack: handlers.handleBack,
      onTabChange: handlers.handleTabChange,
      onFilterNavigate: handlers.handleFilterNavigate,
      onFilterSelect: handlers.handleFilterSelect,
      onFocusFilters: handlers.handleFocusFilters,
    },
    disabled: feedbackMode || showingDrilldownPrompt,
  });

  const canDrilldown = Boolean(reviewId);

  const footerModeShortcuts: ModeShortcuts = useMemo(() => {
    const explainLabel = drilldownState.status === "loading"
      ? "Loading..."
      : canDrilldown ? "Explain" : "View";

    return {
      keys: [
        { key: "j/k", label: "Move" },
        { key: "e", label: explainLabel },
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
  }, [drilldownState.status, canDrilldown]);

  // Empty issues
  if (issues.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={staged ? "green" : "yellow"}>
          Code Review ({staged ? "Staged" : "Unstaged"})
        </Text>
        <Text>
          <Text bold>Summary:</Text> {summary}
        </Text>
        {overallScore !== undefined && overallScore !== null && (
          <Text>
            <Text bold>Score:</Text> {overallScore}/10
          </Text>
        )}
        <Text color="green">No issues found!</Text>
        <Box marginTop={1}>
          <FooterBar shortcuts={EMPTY_FOOTER_SHORTCUTS} />
        </Box>
      </Box>
    );
  }

  // Drilldown prompt
  if (showingDrilldownPrompt && currentDrilldownIssue) {
    const reason = getSuggestionReason(currentDrilldownIssue);
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color={staged ? "green" : "yellow"}>
            Code Review ({staged ? "Staged" : "Unstaged"})
          </Text>
          <Text dimColor> ({issues.length} issues)</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Suggested drilldowns: {pendingDrilldowns.length} remaining</Text>
        </Box>
        <DrilldownPrompt
          issue={currentDrilldownIssue}
          reason={reason}
          onAccept={handleDrilldownAccept}
          onSkip={handleDrilldownSkip}
          onAcceptAll={handleDrilldownAcceptAll}
          isActive={true}
        />
      </Box>
    );
  }

  // Main split view
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={staged ? "green" : "yellow"}>
          Code Review ({staged ? "Staged" : "Unstaged"})
        </Text>
        <Text dimColor>
          {" "}({filteredIssues.length} issues{filterInfo ? ` - ${filterInfo}` : ""})
        </Text>
        {overallScore !== undefined && overallScore !== null && (
          <Text dimColor> Score: {overallScore}/10</Text>
        )}
      </Box>

      <Box marginBottom={1}>
        <Text>
          <Text bold>Summary:</Text> {summary}
        </Text>
      </Box>

      {askResponse && (
        <Box marginBottom={1}>
          <Text color="cyan">{askResponse}</Text>
        </Box>
      )}

      <Box marginBottom={1}>
        <SeverityFilterGroup
          counts={severityCounts}
          activeFilter={severityFilter}
          isFocused={focus === "filters"}
          focusedIndex={filterFocusedIndex}
          onFilterChange={setSeverityFilter}
        />
      </Box>

      <Separator />

      <Box marginTop={1} flexGrow={1} flexDirection="row" gap={1}>
        {shouldShowAgentPanel && (
          <Box flexDirection="column" width={AGENT_PANEL_WIDTH} flexShrink={0}>
            <AgentActivityPanel
              agents={agents}
              currentAction={currentAction}
              height={listPaneHeight}
            />
          </Box>
        )}
        <Box flexGrow={1}>
          <SplitPane leftWidth={shouldShowAgentPanel ? 35 : 40}>
            <IssueListPane
              issues={filteredIssues}
              selectedId={selectedId}
              onSelect={setSelectedId}
              focus={focus === "list"}
              height={listPaneHeight}
            />
            <IssueDetailsPane
              issue={selectedIssue}
              activeTab={activeTab}
              onApplyPatch={handlers.handleApplyFromDetails}
              isApplying={false}
              focus={focus === "details"}
              drilldown={drilldownState.data ?? getCachedDrilldown(selectedIssue?.id ?? "")}
            />
          </SplitPane>
        </Box>
      </Box>

      {feedbackMode && (
        <Box marginTop={1}>
          <FeedbackInput
            isVisible={feedbackMode}
            onCommand={handlers.handleFeedbackCommand}
            onCancel={handlers.handleFeedbackCancel}
          />
        </Box>
      )}

      <Box marginTop={1}>
        <FooterBar modeShortcuts={footerModeShortcuts} />
      </Box>
    </Box>
  );
}

type ReviewPhase = "summary" | "results";

export function ReviewView({ state, staged, reviewId, agentEvents = [], currentReview = null }: ReviewViewProps) {
  const { exit } = useApp();

  const isLoadedReview = currentReview && (state.status === "idle" || state.status === "success");
  const [phase, setPhase] = useState<ReviewPhase>(isLoadedReview ? "results" : "summary");

  const handleBack = useCallback(() => exit(), [exit]);

  const baseShortcuts: Shortcut[] = useMemo(
    () => [
      { key: "s", label: `Toggle ${staged ? "unstaged" : "staged"}` },
      { key: "b", label: "Back" },
      { key: "q", label: "Quit" },
    ],
    [staged]
  );

  const shortcutsWithRefresh: Shortcut[] = useMemo(
    () => [
      { key: "s", label: `Toggle ${staged ? "unstaged" : "staged"}` },
      { key: "r", label: "Refresh" },
      { key: "b", label: "Back" },
      { key: "q", label: "Quit" },
    ],
    [staged]
  );

  // Derive display data from either loaded review or streaming state
  const review = isLoadedReview
    ? {
        issues: currentReview.result.issues,
        summary: currentReview.result.summary,
        reviewId: currentReview.metadata.id,
        staged: currentReview.metadata.staged,
        showAgentPanel: false,
        agentEvents: [] as AgentStreamEvent[],
      }
    : state.status === "success"
      ? {
          issues: state.data.issues,
          summary: state.data.summary,
          reviewId: reviewId ?? state.reviewId,
          staged,
          showAgentPanel: true,
          agentEvents,
        }
      : null;

  // Handle non-success states
  if (!review) {
    if (state.status === "idle") {
      return (
        <Box flexDirection="column" marginTop={1}>
          <IdleDisplay />
          <Box marginTop={1}>
            <FooterBar shortcuts={shortcutsWithRefresh} />
          </Box>
        </Box>
      );
    }

    if (state.status === "loading") {
      return (
        <Box flexDirection="column" marginTop={1}>
          <LoadingDisplay content={state.content} staged={staged} agentEvents={agentEvents} />
          <Box marginTop={1}>
            <FooterBar shortcuts={baseShortcuts} />
          </Box>
        </Box>
      );
    }

    if (state.status === "error") {
      return (
        <Box flexDirection="column" marginTop={1}>
          <ErrorDisplay message={state.error.message} />
          <Box marginTop={1}>
            <FooterBar shortcuts={shortcutsWithRefresh} />
          </Box>
        </Box>
      );
    }

    // Unreachable, but TypeScript needs this
    return null;
  }

  const filesAnalyzed = new Set(review.issues.map((issue) => issue.file)).size;

  if (phase === "summary") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <ReviewSummaryView
          issues={review.issues}
          runId={review.reviewId ?? "N/A"}
          filesAnalyzed={filesAnalyzed}
          lensStats={[]}
          onEnterReview={() => setPhase("results")}
          onBack={handleBack}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <ReviewSplitScreenView
        issues={review.issues}
        summary={review.summary}
        overallScore={null}
        staged={review.staged}
        reviewId={review.reviewId}
        onBack={handleBack}
        agentEvents={review.agentEvents}
        showAgentPanel={review.showAgentPanel}
      />
    </Box>
  );
}
