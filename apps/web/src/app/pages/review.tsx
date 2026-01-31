import { useState, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AnalysisSummary } from "@/components/ui";
import type { LensStats, IssuePreview, SeverityFilter } from "@/components/ui";
import type { TriageSeverity } from "@repo/schemas/triage";
import type { TriageIssue } from "@repo/schemas";
import { SEVERITY_ORDER } from "@repo/schemas/ui";
import { useScope, useKey, useSelectableList } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { ReviewContainer, IssueListPane, IssueDetailsPane, type ReviewMode, type TabId } from "@/features/review/components";
import { calculateSeverityCounts } from "@repo/core";
import { filterIssuesBySeverity } from "@repo/core/review";

type FocusZone = "filters" | "list" | "details";
type ReviewView = "progress" | "summary" | "results";

const MOCK_ISSUES: TriageIssue[] = [
  {
    id: "1",
    severity: "blocker",
    category: "security",
    title: "Potential SQL Injection",
    file: "auth/login.ts",
    line_start: 42,
    line_end: 42,
    rationale: "User input directly concatenated into SQL query",
    recommendation: "Use parameterized queries",
    suggested_patch: `- const query = \`SELECT * FROM users WHERE user = '\${username}'\`;
+ const query = 'SELECT * FROM users WHERE user = ?';
+ const result = await db.query(query, [username]);`,
    confidence: 0.95,
    symptom:
      "The input variable username is concatenated directly into a raw SQL query string without sanitization. This occurs on line 42 within the authentication logic.",
    whyItMatters:
      "This vulnerability allows malicious users to manipulate the query logic by injecting arbitrary SQL commands. An attacker could bypass authentication.",
    fixPlan: [
      { step: 1, action: "Import parameterized query builder", files: ["auth/login.ts"] },
      { step: 2, action: "Replace string concatenation with bound parameters" },
      { step: 3, action: "Validate input type before query execution" },
    ],
    evidence: [
      {
        type: "code",
        title: "Vulnerable code",
        sourceId: "src-1",
        file: "auth/login.ts",
        excerpt: "const query = `SELECT * FROM users WHERE user = '${username}'`;",
      },
    ],
  },
  {
    id: "2",
    severity: "blocker",
    category: "security",
    title: "Unsafe Deserialization",
    file: "api/handlers/data.ts",
    line_start: 88,
    line_end: 92,
    rationale: "Deserializing untrusted data without validation",
    recommendation: "Validate data schema before deserialization",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "The JSON.parse call on line 88 deserializes user-provided data without any schema validation.",
    whyItMatters: "Attackers can craft malicious payloads that exploit prototype pollution or execute arbitrary code.",
    fixPlan: [
      { step: 1, action: "Add Zod schema for expected data structure" },
      { step: 2, action: "Validate parsed data against schema" },
    ],
    evidence: [],
  },
  {
    id: "3",
    severity: "high",
    category: "performance",
    title: "Memory Leak in Loop",
    file: "services/processor.ts",
    line_start: 150,
    line_end: 165,
    rationale: "Event listeners added in loop without cleanup",
    recommendation: "Store references and remove listeners on cleanup",
    suggested_patch: null,
    confidence: 0.85,
    symptom: "Event listeners are attached inside a forEach loop without any mechanism to remove them.",
    whyItMatters: "Each iteration creates a new listener that persists in memory, causing memory exhaustion.",
    fixPlan: [
      { step: 1, action: "Store listener references in array" },
      { step: 2, action: "Add cleanup function to remove all listeners" },
    ],
    evidence: [],
  },
  {
    id: "4",
    severity: "high",
    category: "correctness",
    title: "Missing Error Handling",
    file: "utils/api-client.ts",
    line_start: 24,
    line_end: 28,
    rationale: "Network request has no error handling",
    recommendation: "Wrap in try-catch or use .catch()",
    suggested_patch: null,
    confidence: 0.88,
    symptom: "The fetch call on line 24 does not handle network failures or non-2xx responses.",
    whyItMatters: "Unhandled promise rejections can crash the application or leave it in an inconsistent state.",
    fixPlan: [
      { step: 1, action: "Add try-catch wrapper" },
      { step: 2, action: "Check response.ok before parsing" },
    ],
    evidence: [],
  },
  {
    id: "5",
    severity: "medium",
    category: "performance",
    title: "Inefficient Selector",
    file: "components/Table.tsx",
    line_start: 12,
    line_end: 12,
    rationale: "Selector computes derived state on every render",
    recommendation: "Memoize the selector or use createSelector",
    suggested_patch: null,
    confidence: 0.75,
    symptom: "The useSelector hook on line 12 performs an array filter operation on every render.",
    whyItMatters: "This causes unnecessary re-renders and performance issues with large datasets.",
    evidence: [],
  },
  {
    id: "6",
    severity: "low",
    category: "readability",
    title: "Redundant Code Block",
    file: "views/dashboard.tsx",
    line_start: 201,
    line_end: 215,
    rationale: "Duplicate logic that could be extracted",
    recommendation: "Extract common logic into shared utility",
    suggested_patch: null,
    confidence: 0.7,
    symptom: "Lines 201-215 contain logic nearly identical to lines 180-194 in the same file.",
    whyItMatters: "Duplicated code increases maintenance burden and risk of bugs.",
    evidence: [],
  },
];

function ReviewSummaryView({ onEnterReview, onBack }: { onEnterReview: () => void; onBack: () => void }) {
  const severityCounts = calculateSeverityCounts(MOCK_ISSUES);
  const blockerCount = MOCK_ISSUES.filter((i) => i.severity === "blocker").length;

  const lensStats: LensStats[] = [
    { id: "security", name: "Security", icon: "🛡", iconColor: "text-tui-red", count: 4, change: 2 },
    { id: "performance", name: "Performance", icon: "⚡", iconColor: "text-tui-yellow", count: 5, change: 0 },
    { id: "style", name: "Style", icon: "✨", iconColor: "text-tui-blue", count: 3, change: -1 },
  ];

  const topIssues: IssuePreview[] = MOCK_ISSUES.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: `src/${issue.file}`,
    line: issue.line_start ?? 0,
    category: issue.category,
    severity: issue.severity as TriageSeverity,
  }));

  useScope("review-summary");
  useKey("Enter", onEnterReview);
  useKey("Escape", onBack);

  usePageFooter({
    shortcuts: [{ key: "Enter", label: "Start Review" }],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="w-full max-w-4xl mx-auto">
        <AnalysisSummary
          stats={{ runId: "8821", totalIssues: MOCK_ISSUES.length, filesAnalyzed: 7, criticalCount: blockerCount }}
          severityCounts={severityCounts}
          lensStats={lensStats}
          topIssues={topIssues}
          onEnterReview={onEnterReview}
          onBack={onBack}
        />
      </div>
    </div>
  );
}

function ReviewResultsView() {
  const navigate = useNavigate();
  const [selectedIssueIndex, setSelectedIssueIndex] = useScopedRouteState("issueIndex", 0);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set([1]));

  const filteredIssues = filterIssuesBySeverity(MOCK_ISSUES, severityFilter);

  const { focusedIndex, setFocusedIndex } = useSelectableList({
    itemCount: filteredIssues.length,
    wrap: false,
    enabled: focusZone === "list",
    initialIndex: selectedIssueIndex,
  });

  useEffect(() => {
    if (focusedIndex !== selectedIssueIndex) {
      setSelectedIssueIndex(focusedIndex);
    }
  }, [focusedIndex, selectedIssueIndex, setSelectedIssueIndex]);

  const selectedIssue = filteredIssues[focusedIndex] ?? null;

  useScope("review");
  useKey("Escape", () => navigate({ to: "/" }), { enabled: focusZone === "list" });

  // Pane navigation
  useKey("Tab", () => {
    if (focusZone === "filters") setFocusZone("list");
    else if (focusZone === "list") setFocusZone("details");
    else setFocusZone("filters");
  });

  // Arrow navigation between zones
  useKey("ArrowLeft", () => {
    if (focusZone === "details") setFocusZone("list");
    else if (focusZone === "filters" && focusedFilterIndex > 0) {
      setFocusedFilterIndex((i) => i - 1);
    }
  });

  useKey("ArrowRight", () => {
    if (focusZone === "list") setFocusZone("details");
    else if (focusZone === "filters" && focusedFilterIndex < SEVERITY_ORDER.length - 1) {
      setFocusedFilterIndex((i) => i + 1);
    } else if (focusZone === "filters" && focusedFilterIndex === SEVERITY_ORDER.length - 1) {
      setFocusZone("details");
    }
  });

  // Vertical navigation within list zone - go to filters at top
  useKey("ArrowUp", () => {
    if (focusZone === "list" && focusedIndex === 0) {
      setFocusZone("filters");
    }
  }, { enabled: focusZone === "list" });

  // From filters, go down to list
  useKey("ArrowDown", () => setFocusZone("list"), { enabled: focusZone === "filters" });
  useKey("j", () => setFocusZone("list"), { enabled: focusZone === "filters" });

  // Toggle filter when in filter zone
  useKey("Enter", () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    setSeverityFilter((f) => (f === sev ? "all" : sev));
  }, { enabled: focusZone === "filters" });

  useKey(" ", () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    setSeverityFilter((f) => (f === sev ? "all" : sev));
  }, { enabled: focusZone === "filters" });

  // Tab selection with number keys
  useKey("1", () => setActiveTab("details"), { enabled: focusZone === "details" });
  useKey("2", () => setActiveTab("explain"), { enabled: focusZone === "details" });
  useKey("3", () => setActiveTab("trace"), { enabled: focusZone === "details" });
  useKey("4", () => setActiveTab("patch"), { enabled: focusZone === "details" && !!selectedIssue?.suggested_patch });

  const handleToggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  usePageFooter({
    shortcuts: [
      { key: "j/k", label: "Select" },
      { key: "←/→", label: "Navigate" },
      { key: "1-4", label: "Tab" },
    ],
    rightShortcuts: [
      { key: "Space", label: "Toggle" },
      { key: "Esc", label: "Back" },
    ],
  });

  return (
    <div className="flex flex-1 overflow-hidden px-4 font-mono">
      <IssueListPane
        issues={filteredIssues}
        allIssues={MOCK_ISSUES}
        selectedIndex={focusedIndex}
        onSelectIndex={setFocusedIndex}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
        isFocused={focusZone === "list"}
        isFilterFocused={focusZone === "filters"}
        focusedFilterIndex={focusedFilterIndex}
        title="Analysis #8821"
      />
      <IssueDetailsPane
        issue={selectedIssue}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        completedSteps={completedSteps}
        onToggleStep={handleToggleStep}
        isFocused={focusZone === "details"}
      />
    </div>
  );
}

export function ReviewPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { staged?: boolean; files?: boolean };
  const reviewMode: ReviewMode = search.files ? "files" : search.staged ? "staged" : "unstaged";
  const [view, setView] = useState<ReviewView>("progress");

  if (view === "progress") {
    return <ReviewContainer mode={reviewMode} onComplete={() => setView("summary")} />;
  }

  if (view === "summary") {
    return (
      <ReviewSummaryView
        onEnterReview={() => setView("results")}
        onBack={() => navigate({ to: "/" })}
      />
    );
  }

  return <ReviewResultsView />;
}
