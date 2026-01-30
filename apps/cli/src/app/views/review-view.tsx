import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Box, Text, useApp, useStdout, useInput } from "ink";
import Spinner from "ink-spinner";
import { truncate, getErrorMessage } from "@repo/core";
import { shouldSuggestDrilldown, getSuggestionReason } from "@repo/core/review";
import type { TriageState } from "../../features/review/index.js";
import type { ReviewIssue } from "@repo/schemas/review";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import type { FeedbackCommand } from "@repo/schemas/feedback";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { SplitPane } from "../../components/ui/split-pane.js";
import { Separator } from "../../components/ui/separator.js";
import { FooterBar, type Shortcut, type ModeShortcuts } from "../../components/ui/footer-bar.js";
import { SeverityFilterGroup, type SeverityFilter, SEVERITY_ORDER } from "../../components/ui/severity-filter-group.js";
import type { SeverityLevel } from "../../components/ui/severity-filter-button.js";
import {
  IssueListPane,
  IssueDetailsPane,
  FeedbackInput,
  type IssueTab,
} from "../../features/review/components/index.js";
import { DrilldownPrompt } from "../../features/review/components/drilldown-prompt.js";
import { AgentActivityPanel } from "../../features/review/components/agent-activity-panel.js";
import { ReviewSummaryView } from "../../features/review/components/review-summary-view.js";
import {
  useReviewKeyboard,
  type FocusArea,
} from "../../features/review/hooks/use-review-keyboard.js";
import { useAgentActivity } from "../../features/review/hooks/use-agent-activity.js";
import { triggerDrilldown } from "../../features/review/api/index.js";
import { useSessionRecorderContext } from "../../hooks/index.js";

interface ReviewViewProps {
  state: TriageState;
  staged: boolean;
  reviewId?: string;
  agentEvents?: AgentStreamEvent[];
}

function adaptReviewIssueToTriageIssue(
  issue: ReviewIssue,
  index: number
): TriageIssue {
  return {
    id: `review-issue-${index}`,
    severity: mapReviewSeverityToTriage(issue.severity),
    category: mapReviewCategoryToTriage(issue.category),
    title: issue.title,
    file: issue.file ?? "unknown",
    line_start: issue.line,
    line_end: issue.line,
    rationale: issue.description,
    recommendation: issue.suggestion ?? "",
    suggested_patch: null,
    confidence: 0.8,
    symptom: issue.description,
    whyItMatters: issue.description,
    evidence: [],
    trace: [],
  };
}

function mapReviewSeverityToTriage(
  severity: "critical" | "warning" | "suggestion" | "nitpick"
): TriageIssue["severity"] {
  const map: Record<typeof severity, TriageIssue["severity"]> = {
    critical: "blocker",
    warning: "high",
    suggestion: "medium",
    nitpick: "nit",
  };
  return map[severity];
}

function mapReviewCategoryToTriage(
  category: "security" | "performance" | "style" | "logic" | "documentation" | "best-practice"
): TriageIssue["category"] {
  const map: Record<typeof category, TriageIssue["category"]> = {
    security: "security",
    performance: "performance",
    style: "style",
    logic: "correctness",
    documentation: "readability",
    "best-practice": "correctness",
  };
  return map[category];
}

function issueMatchesPattern(issue: TriageIssue, pattern: string): boolean {
  const lowerPattern = pattern.toLowerCase();
  return (
    issue.title.toLowerCase().includes(lowerPattern) ||
    issue.category.toLowerCase().includes(lowerPattern) ||
    issue.file.toLowerCase().includes(lowerPattern) ||
    issue.rationale.toLowerCase().includes(lowerPattern)
  );
}

function filterIssues(
  issues: TriageIssue[],
  activeFilter: string | null,
  ignoredPatterns: string[]
): TriageIssue[] {
  let filtered = issues;

  if (ignoredPatterns.length > 0) {
    filtered = filtered.filter(
      (issue) => !ignoredPatterns.some((pattern) => issueMatchesPattern(issue, pattern))
    );
  }

  if (activeFilter) {
    const matching: TriageIssue[] = [];
    const nonMatching: TriageIssue[] = [];
    for (const issue of filtered) {
      if (issueMatchesPattern(issue, activeFilter)) {
        matching.push(issue);
      } else {
        nonMatching.push(issue);
      }
    }
    filtered = [...matching, ...nonMatching];
  }

  return filtered;
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
          <Box flexShrink={0} width={28}>
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

interface DrilldownState {
  status: "idle" | "loading" | "success" | "error";
  data: DrilldownResult | null;
  error: string | null;
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

  const [selectedId, setSelectedId] = useState<string | null>(
    issues[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<IssueTab>("details");
  const [focus, setFocus] = useState<FocusArea>("list");
  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    status: "idle",
    data: null,
    error: null,
  });
  const drilldownCacheRef = useRef<Map<string, DrilldownResult>>(new Map());

  const [feedbackMode, setFeedbackMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [ignoredPatterns, setIgnoredPatterns] = useState<string[]>([]);
  const [askResponse, setAskResponse] = useState<string | null>(null);

  // Severity filter state
  const [filterFocusedIndex, setFilterFocusedIndex] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const [pendingDrilldowns, setPendingDrilldowns] = useState<string[]>([]);
  const [showingDrilldownPrompt, setShowingDrilldownPrompt] = useState(false);
  const [currentDrilldownIssue, setCurrentDrilldownIssue] = useState<TriageIssue | null>(null);
  const drilldownSuggestionsCheckedRef = useRef(false);

  const recorderContext = useSessionRecorderContext();
  const prevSelectedIdRef = useRef<string | null>(selectedId);

  const { agents, currentAction } = useAgentActivity(agentEvents);
  const shouldShowAgentPanel = showAgentPanel && agents.length > 0;

  // Compute severity counts for filter buttons
  const severityCounts = useMemo<Record<SeverityLevel, number>>(() => {
    const counts: Record<SeverityLevel, number> = {
      blocker: 0,
      high: 0,
      medium: 0,
      low: 0,
      nit: 0,
    };
    for (const issue of issues) {
      if (issue.severity in counts) {
        counts[issue.severity as SeverityLevel]++;
      }
    }
    return counts;
  }, [issues]);

  // Apply text filter and ignored patterns first
  const textFilteredIssues = useMemo(
    () => filterIssues(issues, activeFilter, ignoredPatterns),
    [issues, activeFilter, ignoredPatterns]
  );

  // Then apply severity filter
  const filteredIssues = useMemo(() => {
    if (severityFilter === "all") {
      return textFilteredIssues;
    }
    return textFilteredIssues.filter((issue) => issue.severity === severityFilter);
  }, [textFilteredIssues, severityFilter]);

  const selectedIndex = useMemo(() => {
    if (!selectedId) return 0;
    const idx = filteredIssues.findIndex((issue) => issue.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [filteredIssues, selectedId]);

  const selectedIssue = filteredIssues[selectedIndex] ?? null;

  useEffect(() => {
    if (drilldownSuggestionsCheckedRef.current) return;
    if (issues.length === 0 || !reviewId) return;

    drilldownSuggestionsCheckedRef.current = true;

    const suggestions = issues
      .filter(shouldSuggestDrilldown)
      .map((issue) => issue.id);

    if (suggestions.length > 0) {
      setPendingDrilldowns(suggestions);
      const firstIssue = issues.find((i) => i.id === suggestions[0]);
      if (firstIssue) {
        setCurrentDrilldownIssue(firstIssue);
        setShowingDrilldownPrompt(true);
      }
    }
  }, [issues, reviewId]);

  useEffect(() => {
    if (prevSelectedIdRef.current !== selectedId && selectedIssue) {
      recorderContext.recordEvent("OPEN_ISSUE", {
        issueId: selectedIssue.id,
        title: selectedIssue.title,
        severity: selectedIssue.severity,
        file: selectedIssue.file,
      });
    }
    prevSelectedIdRef.current = selectedId;
  }, [selectedId, selectedIssue, recorderContext]);

  const handleNavigate = useCallback(
    (direction: "up" | "down") => {
      const delta = direction === "down" ? 1 : -1;
      const newIndex = Math.max(0, Math.min(selectedIndex + delta, filteredIssues.length - 1));
      const issue = filteredIssues[newIndex];
      if (issue) {
        setSelectedId(issue.id);
      }
    },
    [selectedIndex, filteredIssues]
  );

  const handleOpen = useCallback(() => {
    setFocus("details");
  }, []);

  const handleIgnore = useCallback(() => {
    if (!selectedIssue) return;

    recorderContext.recordEvent("IGNORE_ISSUE", {
      issueId: selectedIssue.id,
      title: selectedIssue.title,
      severity: selectedIssue.severity,
    });
  }, [selectedIssue, recorderContext]);

  const handleBack = useCallback(() => {
    if (focus === "details") {
      setFocus("list");
    } else {
      onBack();
    }
  }, [focus, onBack]);

  const handleApply = useCallback(() => {
    if (!selectedIssue) return;

    recorderContext.recordEvent("APPLY_PATCH", {
      issueId: selectedIssue.id,
      title: selectedIssue.title,
      file: selectedIssue.file,
      hasPatch: Boolean(selectedIssue.suggested_patch),
    });
  }, [selectedIssue, recorderContext]);

  const handleApplyFromDetails = useCallback(
    (issue: TriageIssue) => {
      recorderContext.recordEvent("APPLY_PATCH", {
        issueId: issue.id,
        title: issue.title,
        file: issue.file,
        hasPatch: Boolean(issue.suggested_patch),
      });
    },
    [recorderContext]
  );

  const handleDrilldown = useCallback(async () => {
    if (!selectedIssue) return;

    if (!reviewId) {
      setActiveTab("explain");
      return;
    }

    const cached = drilldownCacheRef.current.get(selectedIssue.id);
    if (cached) {
      setDrilldownState({ status: "success", data: cached, error: null });
      setActiveTab("explain");
      return;
    }

    setDrilldownState({ status: "loading", data: null, error: null });

    try {
      const response = await triggerDrilldown({
        reviewId,
        issueId: selectedIssue.id,
      });
      drilldownCacheRef.current.set(selectedIssue.id, response.drilldown);
      setDrilldownState({ status: "success", data: response.drilldown, error: null });
      setActiveTab("explain");
    } catch (error) {
      setDrilldownState({
        status: "error",
        data: null,
        error: getErrorMessage(error),
      });
    }
  }, [selectedIssue, reviewId]);

  const executeDrilldownForIssue = useCallback(
    async (issueId: string) => {
      if (!reviewId) return;

      const cached = drilldownCacheRef.current.get(issueId);
      if (cached) return;

      try {
        const response = await triggerDrilldown({
          reviewId,
          issueId,
        });
        drilldownCacheRef.current.set(issueId, response.drilldown);
      } catch {
        // Silently ignore errors during background drilldown
      }
    },
    [reviewId]
  );

  const advanceToNextDrilldownSuggestion = useCallback(() => {
    const remaining = pendingDrilldowns.slice(1);
    setPendingDrilldowns(remaining);

    if (remaining.length > 0) {
      const nextIssue = issues.find((i) => i.id === remaining[0]);
      if (nextIssue) {
        setCurrentDrilldownIssue(nextIssue);
      } else {
        setShowingDrilldownPrompt(false);
        setCurrentDrilldownIssue(null);
      }
    } else {
      setShowingDrilldownPrompt(false);
      setCurrentDrilldownIssue(null);
    }
  }, [pendingDrilldowns, issues]);

  const handleDrilldownAccept = useCallback(() => {
    if (!currentDrilldownIssue) return;

    void executeDrilldownForIssue(currentDrilldownIssue.id);
    advanceToNextDrilldownSuggestion();
  }, [currentDrilldownIssue, executeDrilldownForIssue, advanceToNextDrilldownSuggestion]);

  const handleDrilldownSkip = useCallback(() => {
    advanceToNextDrilldownSuggestion();
  }, [advanceToNextDrilldownSuggestion]);

  const handleDrilldownAcceptAll = useCallback(async () => {
    setShowingDrilldownPrompt(false);
    setCurrentDrilldownIssue(null);

    for (const issueId of pendingDrilldowns) {
      await executeDrilldownForIssue(issueId);
    }

    setPendingDrilldowns([]);
  }, [pendingDrilldowns, executeDrilldownForIssue]);

  const handleExplain = useCallback(() => {
    void handleDrilldown();
  }, [handleDrilldown]);

  const handleTrace = useCallback(() => {
    setActiveTab("trace");
  }, []);

  const handleNextIssue = useCallback(() => {
    handleNavigate("down");
  }, [handleNavigate]);

  const handlePrevIssue = useCallback(() => {
    handleNavigate("up");
  }, [handleNavigate]);

  const handleToggleFocus = useCallback(() => {
    setFocus((prev) => {
      if (prev === "filters") return "list";
      if (prev === "list") return "details";
      return "filters";
    });
  }, []);

  const handleTabChange = useCallback((tab: IssueTab) => {
    setActiveTab(tab);
  }, []);

  const handleFocusFilters = useCallback(() => {
    setFocus("filters");
  }, []);

  const handleFilterNavigate = useCallback((direction: "left" | "right") => {
    setFilterFocusedIndex((prev) => {
      const delta = direction === "right" ? 1 : -1;
      const newIndex = prev + delta;
      return Math.max(0, Math.min(newIndex, SEVERITY_ORDER.length - 1));
    });
  }, []);

  const handleFilterSelect = useCallback(() => {
    const selectedSeverity = SEVERITY_ORDER[filterFocusedIndex];
    if (selectedSeverity) {
      setSeverityFilter((prev) =>
        prev === selectedSeverity ? "all" : selectedSeverity
      );
    }
  }, [filterFocusedIndex]);

  const handleFeedbackCommand = useCallback(
    (command: FeedbackCommand) => {
      setFeedbackMode(false);

      switch (command.type) {
        case "focus":
          setActiveFilter(command.filter);
          recorderContext.recordEvent("FILTER_CHANGED", {
            filter: command.filter,
            type: "focus",
          });
          break;

        case "ignore":
          setIgnoredPatterns((prev) => [...prev, command.pattern]);
          recorderContext.recordEvent("FILTER_CHANGED", {
            pattern: command.pattern,
            type: "ignore",
          });
          break;

        case "refine": {
          const targetIssue = filteredIssues.find(
            (issue) =>
              issue.id === command.issueId ||
              issue.id.endsWith(command.issueId) ||
              issue.title.toLowerCase().includes(command.issueId.toLowerCase())
          );
          if (targetIssue) {
            setSelectedId(targetIssue.id);
            void handleDrilldown();
          }
          break;
        }

        case "ask":
          setAskResponse(`Question received: "${command.question}" (response placeholder)`);
          break;

        case "stop":
          break;
      }
    },
    [filteredIssues, handleDrilldown, recorderContext]
  );

  const handleFeedbackCancel = useCallback(() => {
    setFeedbackMode(false);
  }, []);

  useInput(
    (input, _key) => {
      if (feedbackMode || showingDrilldownPrompt) return;

      if (input === "/" || input === ":") {
        setFeedbackMode(true);
      }
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

  const filterInfo = useMemo(() => {
    const parts: string[] = [];
    if (activeFilter) {
      parts.push(`filter: "${activeFilter}"`);
    }
    if (ignoredPatterns.length > 0) {
      parts.push(`${ignoredPatterns.length} ignored`);
    }
    if (filteredIssues.length !== issues.length) {
      parts.push(`showing ${filteredIssues.length}/${issues.length}`);
    }
    return parts.join(" | ");
  }, [activeFilter, ignoredPatterns.length, filteredIssues.length, issues.length]);

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

  if (showingDrilldownPrompt && currentDrilldownIssue) {
    const reason = getSuggestionReason(currentDrilldownIssue);
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color={staged ? "green" : "yellow"}>
            Code Review ({staged ? "Staged" : "Unstaged"})
          </Text>
          <Text dimColor>
            {" "}
            ({issues.length} issues)
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>
            Suggested drilldowns: {pendingDrilldowns.length} remaining
          </Text>
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={staged ? "green" : "yellow"}>
          Code Review ({staged ? "Staged" : "Unstaged"})
        </Text>
        <Text dimColor>
          {" "}
          ({filteredIssues.length} issues{filterInfo ? ` - ${filterInfo}` : ""})
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
          <Box flexDirection="column" width={28} flexShrink={0}>
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
              onApplyPatch={handleApplyFromDetails}
              isApplying={false}
              focus={focus === "details"}
              drilldown={drilldownState.data}
            />
          </SplitPane>
        </Box>
      </Box>

      {feedbackMode && (
        <Box marginTop={1}>
          <FeedbackInput
            isVisible={feedbackMode}
            onCommand={handleFeedbackCommand}
            onCancel={handleFeedbackCancel}
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

export function ReviewView({ state, staged, reviewId, agentEvents = [] }: ReviewViewProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<ReviewPhase>("summary");

  const handleBack = useCallback(() => {
    exit();
  }, [exit]);

  const idleShortcuts: Shortcut[] = useMemo(
    () => [
      { key: "s", label: `Toggle ${staged ? "unstaged" : "staged"}` },
      { key: "r", label: "Refresh" },
      { key: "b", label: "Back" },
      { key: "q", label: "Quit" },
    ],
    [staged]
  );

  const loadingShortcuts: Shortcut[] = useMemo(
    () => [
      { key: "s", label: `Toggle ${staged ? "unstaged" : "staged"}` },
      { key: "b", label: "Back" },
      { key: "q", label: "Quit" },
    ],
    [staged]
  );

  const errorShortcuts: Shortcut[] = useMemo(
    () => [
      { key: "s", label: `Toggle ${staged ? "unstaged" : "staged"}` },
      { key: "r", label: "Refresh" },
      { key: "b", label: "Back" },
      { key: "q", label: "Quit" },
    ],
    [staged]
  );

  if (state.status === "idle") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <IdleDisplay />
        <Box marginTop={1}>
          <FooterBar shortcuts={idleShortcuts} />
        </Box>
      </Box>
    );
  }

  if (state.status === "loading") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <LoadingDisplay content={state.content} staged={staged} agentEvents={agentEvents} />
        <Box marginTop={1}>
          <FooterBar shortcuts={loadingShortcuts} />
        </Box>
      </Box>
    );
  }

  if (state.status === "error") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <ErrorDisplay message={state.error.message} />
        <Box marginTop={1}>
          <FooterBar shortcuts={errorShortcuts} />
        </Box>
      </Box>
    );
  }

  const { data, reviewId: triageReviewId } = state;

  // Compute filesAnalyzed from unique files in issues
  const filesAnalyzed = useMemo(() => {
    const uniqueFiles = new Set(data.issues.map((issue) => issue.file));
    return uniqueFiles.size;
  }, [data.issues]);

  if (phase === "summary") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <ReviewSummaryView
          issues={data.issues}
          runId={triageReviewId ?? reviewId ?? "N/A"}
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
        issues={data.issues}
        summary={data.summary}
        overallScore={null}
        staged={staged}
        reviewId={reviewId ?? triageReviewId}
        onBack={handleBack}
        agentEvents={agentEvents}
        showAgentPanel={true}
      />
    </Box>
  );
}
