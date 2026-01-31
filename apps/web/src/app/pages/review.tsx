import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearch, useParams } from "@tanstack/react-router";
import { AnalysisSummary } from "@/components/ui";
import type { LensStats, IssuePreview, SeverityFilter } from "@/components/ui";
import type { TriageIssue } from "@repo/schemas";
import { SEVERITY_ORDER } from "@repo/schemas/ui";
import { useScope, useKey, useSelectableList } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { ReviewContainer, IssueListPane, IssueDetailsPane, type ReviewMode, type TabId, type ReviewCompleteData } from "@/features/review/components";
import { useExistingReview } from "@/features/review/hooks";
import { calculateSeverityCounts } from "@repo/core";
import { filterIssuesBySeverity } from "@repo/core/review";

type FocusZone = "filters" | "list" | "details";
type ReviewView = "progress" | "summary" | "results";

interface ReviewData {
  issues: TriageIssue[];
  reviewId: string | null;
  error: string | null;
}

interface ReviewSummaryViewProps {
  issues: TriageIssue[];
  reviewId: string | null;
  onEnterReview: () => void;
  onBack: () => void;
}

function ReviewSummaryView({ issues, reviewId, onEnterReview, onBack }: ReviewSummaryViewProps) {
  const severityCounts = calculateSeverityCounts(issues);

  // Calculate lens stats from actual issues by counting categories
  const categoryCountMap = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {});

  const lensStats: LensStats[] = Object.entries(categoryCountMap).map(([category, count]) => ({
    id: category,
    name: category.charAt(0).toUpperCase() + category.slice(1),
    icon: category === "security" ? "shield" : category === "performance" ? "zap" : "code",
    iconColor: category === "security" ? "text-tui-red" : category === "performance" ? "text-tui-yellow" : "text-tui-blue",
    count,
    change: 0,
  }));

  const topIssues: IssuePreview[] = issues.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: issue.file,
    line: issue.line_start ?? 0,
    category: issue.category,
    severity: issue.severity,
  }));

  // Get unique files analyzed
  const filesAnalyzed = new Set(issues.map((i) => i.file)).size;

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
          // reviewId is null only briefly during initial state before review completes
          stats={{ runId: reviewId ?? "unknown", totalIssues: issues.length, filesAnalyzed, criticalCount: severityCounts.blocker }}
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

interface ReviewResultsViewProps {
  issues: TriageIssue[];
  reviewId: string | null;
}

function ReviewResultsView({ issues, reviewId }: ReviewResultsViewProps) {
  const navigate = useNavigate();
  const [selectedIssueIndex, setSelectedIssueIndex] = useScopedRouteState("issueIndex", 0);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set([1]));

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);

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
        allIssues={issues}
        selectedIndex={focusedIndex}
        onSelectIndex={setFocusedIndex}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
        isFocused={focusZone === "list"}
        isFilterFocused={focusZone === "filters"}
        focusedFilterIndex={focusedFilterIndex}
        // reviewId is null only briefly during initial state before review completes
        title={`Analysis #${reviewId ?? "unknown"}`}
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
  const params = useParams({ strict: false }) as { reviewId?: string };
  const search = useSearch({ strict: false }) as { staged?: boolean; files?: boolean };
  const reviewMode: ReviewMode = search.files ? "files" : search.staged ? "staged" : "unstaged";
  const [view, setView] = useState<ReviewView>(params.reviewId ? "results" : "progress");
  const [reviewData, setReviewData] = useState<ReviewData>({ issues: [], reviewId: null, error: null });

  const { review: existingReview, isLoading, error: existingError } = useExistingReview(params.reviewId);

  useEffect(() => {
    // Only load from API if we don't already have data (navigated directly to /review/:id)
    if (existingReview && !reviewData.reviewId) {
      setReviewData({
        issues: existingReview.result.issues,
        reviewId: existingReview.metadata.id,
        error: null,
      });
      setView("results");
    }
  }, [existingReview, reviewData.reviewId]);

  const handleComplete = useCallback((data: ReviewCompleteData) => {
    setReviewData(data);
    if (!data.error) {
      setView("summary");
      // Update URL without triggering a new fetch (we already have the data)
      if (data.reviewId) {
        navigate({ to: "/review/$reviewId", params: { reviewId: data.reviewId }, replace: true });
      }
    }
  }, [navigate]);

  if (params.reviewId && isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-tui-fg-muted" role="status" aria-live="polite">Loading review...</span>
      </div>
    );
  }

  if (params.reviewId && existingError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-tui-red" role="alert">Failed to load review: {existingError}</span>
      </div>
    );
  }

  if (view === "progress") {
    return <ReviewContainer mode={reviewMode} onComplete={handleComplete} />;
  }

  if (view === "summary") {
    return (
      <ReviewSummaryView
        issues={reviewData.issues}
        reviewId={reviewData.reviewId}
        onEnterReview={() => setView("results")}
        onBack={() => navigate({ to: "/" })}
      />
    );
  }

  return <ReviewResultsView issues={reviewData.issues} reviewId={reviewData.reviewId} />;
}
