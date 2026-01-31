import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FocusablePane, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import type { TriageIssue } from "@repo/schemas";
import type { HistoryTabId, HistoryFocusZone } from "@repo/schemas/history";
import type { TimelineItem } from "@repo/schemas/ui";
import { calculateSeverityCounts } from "@repo/core";
import { useScope, useKey } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { RunAccordionItem, TimelineList, HistoryInsightsPane } from "@/features/history/components";

// Local extension of HistoryRun for web-specific React.ReactNode summary
interface HistoryRun {
  id: string;
  displayId: string;
  date: string;
  branch: string;
  provider: string;
  timestamp: string;
  summary: React.ReactNode;
  issues: TriageIssue[];
  passed: boolean;
}

// Mock data
const MOCK_ISSUES: TriageIssue[] = [
  {
    id: "1",
    severity: "blocker",
    category: "security",
    title: "Missing CSRF token validation in login handler",
    file: "auth/login.ts",
    line_start: 42,
    line_end: 42,
    rationale: "No CSRF protection",
    recommendation: "Add CSRF token validation",
    suggested_patch: null,
    confidence: 0.95,
    evidence: [],
    symptom: "Login handler accepts requests without CSRF validation",
    whyItMatters: "Exposes application to cross-site request forgery attacks",
  },
  {
    id: "2",
    severity: "blocker",
    category: "security",
    title: "Plaintext password storage detected in memory",
    file: "auth/session.ts",
    line_start: 89,
    line_end: 92,
    rationale: "Passwords stored in plaintext",
    recommendation: "Hash passwords before storage",
    suggested_patch: null,
    confidence: 0.92,
    evidence: [],
    symptom: "Password strings stored without hashing in session memory",
    whyItMatters: "Memory dumps or process inspection could expose user credentials",
  },
  {
    id: "3",
    severity: "high",
    category: "performance",
    title: "Inefficient SQL query inside loop",
    file: "services/data.ts",
    line_start: 115,
    line_end: 120,
    rationale: "N+1 query pattern",
    recommendation: "Batch queries",
    suggested_patch: null,
    confidence: 0.88,
    evidence: [],
    symptom: "Database queries executed inside iteration loop",
    whyItMatters: "Causes exponential performance degradation with data growth",
  },
];

const MOCK_RUNS: HistoryRun[] = [
  {
    id: "8821",
    displayId: "#8821",
    date: "today",
    branch: "Staged",
    provider: "GPT-4o",
    timestamp: "10:42 AM",
    summary: <>Found <span className="text-tui-red font-bold">2 critical</span> issues in auth module flow.</>,
    issues: MOCK_ISSUES,
    passed: false,
  },
  {
    id: "8820",
    displayId: "#8820",
    date: "today",
    branch: "Main",
    provider: "GPT-3.5",
    timestamp: "09:15 AM",
    summary: "Regression test passed. No anomalies detected.",
    issues: [],
    passed: true,
  },
  {
    id: "8819",
    displayId: "#8819",
    date: "today",
    branch: "feat/auth",
    provider: "GPT-4o",
    timestamp: "08:30 AM",
    summary: <><span className="text-tui-yellow">1 High</span> severity issue in database migration.</>,
    issues: [MOCK_ISSUES[2]],
    passed: false,
  },
  {
    id: "8818",
    displayId: "#8818",
    date: "today",
    branch: "hotfix/db",
    provider: "Claude-3",
    timestamp: "08:15 AM",
    summary: "Schema validation failed on user table.",
    issues: [],
    passed: false,
  },
  {
    id: "8817",
    displayId: "#8817",
    date: "yesterday",
    branch: "Unstaged",
    provider: "GPT-3.5",
    timestamp: "Yesterday",
    summary: "Passed with no issues.",
    issues: [],
    passed: true,
  },
];

const TIMELINE_ITEMS: TimelineItem[] = [
  { id: "today", label: "Today", count: 4 },
  { id: "yesterday", label: "Yesterday", count: 8 },
  { id: "jan29", label: "Jan 29", count: 12 },
  { id: "jan28", label: "Jan 28", count: 5 },
];


export function HistoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HistoryTabId>("runs");
  const [focusZone, setFocusZone] = useState<HistoryFocusZone>("runs");
  const [selectedDateId, setSelectedDateId] = useScopedRouteState("date", "today");
  const [selectedRunId, setSelectedRunId] = useScopedRouteState("run", MOCK_RUNS[0]?.id ?? null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Filter runs by selected date
  const filteredRuns = useMemo(
    () => MOCK_RUNS.filter((run) => run.date === selectedDateId),
    [selectedDateId]
  );

  // Get selected run data for insights
  const selectedRun = useMemo(
    () => MOCK_RUNS.find((run) => run.id === selectedRunId) ?? null,
    [selectedRunId]
  );

  const severityCounts = useMemo(
    () => (selectedRun ? calculateSeverityCounts(selectedRun.issues) : { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 }),
    [selectedRun]
  );

  const topLenses = ["Security", "Auth", "OWASP"];
  const topIssues = selectedRun?.issues.slice(0, 3) ?? [];

  // Keyboard scope
  useScope("history");

  // Tab switching
  useKey("Tab", () => {
    setFocusZone((prev) => {
      if (prev === "timeline") return "runs";
      if (prev === "runs") return "insights";
      return "timeline";
    });
  });

  // Arrow navigation between zones
  useKey("ArrowLeft", () => {
    if (focusZone === "runs") setFocusZone("timeline");
    else if (focusZone === "insights") setFocusZone("runs");
  });

  useKey("ArrowRight", () => {
    if (focusZone === "timeline") setFocusZone("runs");
    else if (focusZone === "runs") setFocusZone("insights");
  });

  // Expand/collapse with Enter
  useKey("Enter", () => {
    if (focusZone === "runs" && selectedRunId) {
      setExpandedRunId((prev) => (prev === selectedRunId ? null : selectedRunId));
    }
  }, { enabled: focusZone === "runs" });

  // Open in full review
  useKey("o", () => {
    if (selectedRunId) {
      navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
    }
  }, { enabled: focusZone === "runs" });

  // Escape handling
  useKey("Escape", () => {
    if (expandedRunId) {
      setExpandedRunId(null);
    } else {
      navigate({ to: "/" });
    }
  });

  // Page footer shortcuts
  usePageFooter({
    shortcuts: [
      { key: "Tab", label: "Switch Focus" },
      { key: "Enter", label: "Expand" },
      { key: "o", label: "Open" },
    ],
    rightShortcuts: [
      { key: "r", label: "Resume" },
      { key: "e", label: "Export" },
      { key: "Esc", label: "Back" },
    ],
  });

  // Handle boundary navigation
  const handleTimelineBoundary = (direction: "up" | "down") => {
    if (direction === "down") setFocusZone("runs");
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden px-4 pb-0">
      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-tui-border mb-0 text-sm select-none shrink-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HistoryTabId)}>
          <TabsList className="border-b-0">
            <TabsTrigger value="runs">[Runs]</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden border-x border-b border-tui-border">
        {/* Timeline (left) */}
        <FocusablePane
          isFocused={focusZone === "timeline"}
          className="w-48 border-r border-tui-border flex flex-col shrink-0"
        >
          <div className="p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border">
            Timeline
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <TimelineList
              items={TIMELINE_ITEMS}
              selectedId={selectedDateId}
              onSelect={setSelectedDateId}
              keyboardEnabled={focusZone === "timeline"}
              onBoundaryReached={handleTimelineBoundary}
            />
          </div>
        </FocusablePane>

        {/* Runs (middle) */}
        <FocusablePane
          isFocused={focusZone === "runs"}
          className="flex-1 min-w-0 border-r border-tui-border flex flex-col overflow-hidden"
        >
          <div className="p-3 text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-tui-border flex justify-between overflow-hidden">
            <span className="truncate">Runs</span>
            <span className="shrink-0 ml-2">Sort: Recent</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === "runs" ? (
              filteredRuns.map((run) => (
                <RunAccordionItem
                  key={run.id}
                  id={run.id}
                  displayId={run.displayId}
                  branch={run.branch}
                  provider={run.provider}
                  timestamp={run.timestamp}
                  summary={run.summary}
                  issues={run.issues}
                  isSelected={run.id === selectedRunId}
                  isExpanded={run.id === expandedRunId}
                  onSelect={() => setSelectedRunId(run.id)}
                  onToggleExpand={() => setExpandedRunId((prev) => (prev === run.id ? null : run.id))}
                  onIssueClick={(_issueId) => {
                    navigate({ to: "/review/$reviewId", params: { reviewId: run.id } });
                  }}
                />
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No sessions available
              </div>
            )}
          </div>
        </FocusablePane>

        {/* Insights (right) */}
        <FocusablePane
          isFocused={focusZone === "insights"}
          className="w-80 flex flex-col shrink-0 overflow-hidden"
        >
          <HistoryInsightsPane
            runId={selectedRun?.displayId ?? null}
            severityCounts={severityCounts}
            topLenses={topLenses}
            topIssues={topIssues}
            duration="4m 12s"
            onIssueClick={(_issueId) => {
              if (selectedRunId) {
                navigate({ to: "/review/$reviewId", params: { reviewId: selectedRunId } });
              }
            }}
          />
        </FocusablePane>
      </div>

      {/* Search bar placeholder */}
      <div className="flex items-center gap-2 p-3 bg-tui-bg border-x border-b border-tui-border text-sm font-mono shrink-0">
        <span className="text-tui-blue font-bold">&gt;</span>
        <span className="text-gray-500">Search runs by ID, provider or tag...</span>
        <span className="w-2 h-4 bg-tui-blue opacity-50 animate-pulse" />
      </div>
    </div>
  );
}
