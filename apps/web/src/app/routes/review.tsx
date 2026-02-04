import { useState, useEffect, useCallback, useRef } from "react";
import {
  useSearch,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { AnalysisSummary } from "@/components/ui";
import type { LensStats, IssuePreview, SeverityFilter } from "@/components/ui";
import type { TriageIssue, TriageResult } from "@stargazer/schemas";
import { SEVERITY_ORDER } from "@stargazer/schemas/ui";
import { useScope, useKey, useSelectableList } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import {
  ReviewContainer,
  IssueListPane,
  IssueDetailsPane,
  type TabId,
  type ReviewCompleteData,
} from "@/features/review/components";
import type { ReviewSearch } from "@/app/router";
import { useReviewErrorHandler } from "@/features/review/hooks";
import { calculateSeverityCounts } from "@stargazer/core";
import { filterIssuesBySeverity } from "@stargazer/core/review";
import { api } from "@/lib/api";

type FocusZone = "filters" | "list" | "details";
type ReviewView = "progress" | "summary" | "results";

interface ReviewData {
  issues: TriageIssue[];
  reviewId: string | null;
}

interface ReviewSummaryViewProps {
  issues: TriageIssue[];
  reviewId: string | null;
  onEnterReview: () => void;
  onBack: () => void;
}

function ReviewSummaryView({
  issues,
  reviewId,
  onEnterReview,
  onBack,
}: ReviewSummaryViewProps) {
  const router = useRouter();
  const severityCounts = calculateSeverityCounts(issues);

  const categoryCountMap = issues.reduce<Record<string, number>>(
    (acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    },
    {},
  );

  const lensStats: LensStats[] = Object.entries(categoryCountMap).map(
    ([category, count]) => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(1),
      icon:
        category === "security"
          ? "shield"
          : category === "performance"
            ? "zap"
            : "code",
      iconColor:
        category === "security"
          ? "text-tui-red"
          : category === "performance"
            ? "text-tui-yellow"
            : "text-tui-blue",
      count,
      change: 0,
    }),
  );

  const topIssues: IssuePreview[] = issues.slice(0, 3).map((issue) => ({
    id: issue.id,
    title: issue.title,
    file: issue.file,
    line: issue.line_start ?? 0,
    category: issue.category,
    severity: issue.severity,
  }));

  const filesAnalyzed = new Set(issues.map((i) => i.file)).size;

  useScope("review-summary");
  useKey("Enter", onEnterReview);
  useKey("Escape", () => router.history.back());

  usePageFooter({
    shortcuts: [{ key: "Enter", label: "Start Review" }],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="w-full max-w-4xl mx-auto">
        <AnalysisSummary
          stats={{
            runId: reviewId ?? "unknown",
            totalIssues: issues.length,
            filesAnalyzed,
            criticalCount: severityCounts.blocker,
          }}
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
  const router = useRouter();
  const [selectedIssueIndex, setSelectedIssueIndex] = useScopedRouteState(
    "issueIndex",
    0,
  );
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set([1]),
  );

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

  const handleBack = () => router.history.back();

  useScope("review");
  useKey("Escape", handleBack, { enabled: focusZone === "list" });

  useKey("Tab", () => {
    if (focusZone === "filters") setFocusZone("list");
    else if (focusZone === "list") setFocusZone("details");
    else setFocusZone("filters");
  });

  useKey("ArrowLeft", () => {
    if (focusZone === "details") setFocusZone("list");
    else if (focusZone === "filters" && focusedFilterIndex > 0) {
      setFocusedFilterIndex((i) => i - 1);
    }
  });

  useKey("ArrowRight", () => {
    if (focusZone === "list") setFocusZone("details");
    else if (focusZone === "filters") {
      if (focusedFilterIndex < SEVERITY_ORDER.length - 1) {
        setFocusedFilterIndex((i) => i + 1);
      } else {
        setFocusZone("details");
      }
    }
  });

  useKey(
    "ArrowUp",
    () => {
      if (focusZone === "list" && focusedIndex === 0) {
        setFocusZone("filters");
      }
    },
    { enabled: focusZone === "list" },
  );

  useKey("ArrowDown", () => setFocusZone("list"), {
    enabled: focusZone === "filters",
  });
  useKey("j", () => setFocusZone("list"), { enabled: focusZone === "filters" });

  const handleToggleSeverityFilter = () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    setSeverityFilter((f) => (f === sev ? "all" : sev));
  };

  useKey("Enter", handleToggleSeverityFilter, {
    enabled: focusZone === "filters",
  });
  useKey(" ", handleToggleSeverityFilter, { enabled: focusZone === "filters" });

  useKey("1", () => setActiveTab("details"), {
    enabled: focusZone === "details",
  });
  useKey("2", () => setActiveTab("explain"), {
    enabled: focusZone === "details",
  });
  useKey("3", () => setActiveTab("trace"), {
    enabled: focusZone === "details",
  });
  useKey("4", () => setActiveTab("patch"), {
    enabled: focusZone === "details" && !!selectedIssue?.suggested_patch,
  });

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
    <div className="flex flex-col flex-1 overflow-hidden px-4 font-mono">
      <div className="flex items-center gap-4 py-2 border-b border-tui-border mb-2 shrink-0">
        <span className="text-sm font-medium text-tui-violet">
          Analysis #{reviewId ?? "unknown"}
        </span>
      </div>
      <div className="flex flex-1 overflow-hidden">
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
    </div>
  );
}

export function ReviewPage() {
  const params = useParams({ strict: false }) as { reviewId?: string };
  const search = useSearch({ strict: false }) as ReviewSearch;
  const reviewMode = search.mode;
  const [view, setView] = useState<ReviewView>("progress");
  const [reviewData, setReviewData] = useState<ReviewData>({
    issues: [],
    reviewId: null,
  });
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  // Start as true if we have a reviewId - prevents ReviewContainer from mounting before check completes
  const [isCheckingStatus, setIsCheckingStatus] = useState(!!params.reviewId);
  // Tracks whether pre-check completed so we don't re-run it
  const [statusCheckDone, setStatusCheckDone] = useState(false);
  const initialReviewIdRef = useRef(params.reviewId);
  const { handleApiError } = useReviewErrorHandler();

  // Called when ReviewContainer's resume attempt fails - review exists in storage but not as active session
  const handleResumeFailed = useCallback(
    async (reviewId: string) => {
      // Pre-check already verified status, so just try to load from storage
      setIsLoadingSaved(true);
      try {
        const { review } = await api.getTriageReview(reviewId);
        const result = review.result as TriageResult;
        setReviewData({
          issues: result.issues,
          reviewId: review.metadata.id,
        });
        setView("results");
      } catch (error) {
        handleApiError(error);
      } finally {
        setIsLoadingSaved(false);
      }
    },
    [handleApiError],
  );

  const handleComplete = useCallback(
    (data: ReviewCompleteData) => {
      if (data.resumeFailed && data.reviewId) {
        handleResumeFailed(data.reviewId);
        return;
      }
      setReviewData(data);
      setView("summary");
    },
    [handleResumeFailed],
  );

  // Pre-check review status before mounting ReviewContainer
  // Uses lightweight status endpoint first, only loads full review if already saved
  useEffect(() => {
    if (!initialReviewIdRef.current || !params.reviewId || statusCheckDone)
      return;

    const controller = new AbortController();

    const checkStatus = async () => {
      setIsCheckingStatus(true);
      try {
        const status = await api.getReviewStatus(params.reviewId!);

        if (controller.signal.aborted) return;

        if (status.sessionActive) {
          // Active session exists - let ReviewContainer handle resume
          setStatusCheckDone(true);
          setIsCheckingStatus(false);
          return;
        }

        if (status.reviewSaved) {
          // Review exists in storage - load it directly
          const { review } = await api.getTriageReview(params.reviewId!);
          if (controller.signal.aborted) return;
          const result = review.result as TriageResult;
          setReviewData({
            issues: result.issues,
            reviewId: review.metadata.id,
          });
          setView("results");
          setStatusCheckDone(true);
          setIsCheckingStatus(false);
          return;
        }

        // Neither active nor saved - review doesn't exist
        handleApiError({ status: 404, message: "Review not found" });
      } catch (error) {
        if (controller.signal.aborted) return;
        handleApiError(error);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkStatus();

    return () => controller.abort();
  }, [params.reviewId, statusCheckDone, handleApiError]);

  if (view === "progress") {
    if (isLoadingSaved || isCheckingStatus) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div
            className="text-gray-500 font-mono text-sm"
            role="status"
            aria-live="polite"
          >
            {isCheckingStatus ? "Checking review..." : "Loading review..."}
          </div>
        </div>
      );
    }
    return <ReviewContainer mode={reviewMode} onComplete={handleComplete} />;
  }

  const router = useRouter();

  if (view === "summary") {
    return (
      <ReviewSummaryView
        issues={reviewData.issues}
        reviewId={reviewData.reviewId}
        onEnterReview={() => setView("results")}
        onBack={() => router.history.back()}
      />
    );
  }

  return (
    <ReviewResultsView
      issues={reviewData.issues}
      reviewId={reviewData.reviewId}
    />
  );
}
