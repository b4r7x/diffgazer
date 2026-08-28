import { reviewQueries, useApi, useCreateReview, useReview } from "@diffgazer/core/api/hooks";
import {
  describeReviewStartError,
  hasCompletedLens,
  type ReviewScreenPhase,
  resolveSavedReviewOutcome,
  sanitizePresentationText,
  toSavedReviewQueryState,
} from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Button } from "@diffgazer/ui/components/button";
import { toast } from "@diffgazer/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCanGoBack,
  useLocation,
  useNavigate,
  useParams,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useProviderConsent } from "@/hooks/use-provider-consent";
import { performBackAction, resolveBackAction } from "@/lib/back-navigation";
import { useReviewErrorHandler } from "../hooks/use-error-handler";
import { type ReviewCompleteData, ReviewContainer, ReviewLoadingMessage } from "./container";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView, type SummaryAction } from "./summary-view";

type ReviewData = ReviewCompleteData;

type LiveReviewState =
  | { phase: Extract<ReviewScreenPhase, "streaming">; reviewId: string }
  | { phase: Extract<ReviewScreenPhase, "summary" | "results">; reviewData: ReviewData };

type ReviewPageLiveState = LiveReviewState | { phase: "stream-not-found" };

const REVIEW_ROUTE = "/review/{-$reviewId}" as const;

/**
 * The `issueId` search param is user-editable shared state, so a deep link is
 * honored only when it names an issue this review actually produced. Both the
 * saved and the live results branch resolve it here so neither can skip the guard.
 */
function resolveValidIssueId(
  issues: readonly { id: string }[],
  issueId: string | null,
): string | null {
  if (!issueId) return null;
  return issues.some((issue) => issue.id === issueId) ? issueId : null;
}

function getLiveReviewId(state: ReviewPageLiveState | null): string | null {
  if (!state || state.phase === "stream-not-found") return null;
  if (state.phase === "streaming") return state.reviewId;
  return state.reviewData.reviewId;
}

export function ReviewPage() {
  const params = useParams({ from: REVIEW_ROUTE });
  const search = useSearch({ from: REVIEW_ROUTE });
  const reviewMode = search.mode;
  const isLiveNavigation = search.live === true;
  const initialIssueId = search.issueId ?? null;
  const reviewId = params.reviewId ?? null;
  const [liveState, setLiveState] = useState<ReviewPageLiveState | null>(
    reviewId && isLiveNavigation ? { phase: "streaming", reviewId } : null,
  );
  // Which of a saved run's two screens is showing. "auto" defers to the run and
  // the route (resolved in one place below). Only an explicit move out of the
  // summary lands here as "results", so the back grammar can tell a
  // summary-entered results screen from an auto-opened one.
  const [savedScreen, setSavedScreen] = useState<"auto" | "summary" | "results">("auto");
  const notFoundReportedRef = useRef<string | null>(null);
  const reportErrorReportedRef = useRef<string | null>(null);

  // Reset the screen state when the route's review identity changes, during
  // render (no derived-state effect): a new reviewId/live navigation starts a
  // fresh streaming/idle screen rather than reusing the previous review's state.
  const [routeKey, setRouteKey] = useState(`${reviewId ?? ""}:${isLiveNavigation}`);
  const nextRouteKey = `${reviewId ?? ""}:${isLiveNavigation}`;
  if (routeKey !== nextRouteKey) {
    setRouteKey(nextRouteKey);
    setLiveState(reviewId && isLiveNavigation ? { phase: "streaming", reviewId } : null);
    setSavedScreen("auto");
  }

  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const createReview = useCreateReview();
  const providerConsent = useProviderConsent();
  const api = useApi();
  const queryClient = useQueryClient();
  // A second activation can land before React re-renders the row as disabled,
  // so re-entrancy is refused off a ref rather than off the pending flag alone.
  const isStartingRef = useRef(false);
  const [isStartingRerun, setIsStartingRerun] = useState(false);
  const { handleApiError } = useReviewErrorHandler();

  const liveReviewId = getLiveReviewId(liveState);
  const isLiveReviewRoute = Boolean(reviewId && liveReviewId === reviewId);
  const streamGone = liveState?.phase === "stream-not-found";
  const shouldLoadSavedReview = Boolean(
    reviewId && !isLiveReviewRoute && (!liveState || streamGone),
  );
  const savedReviewQuery = useReview(shouldLoadSavedReview ? (reviewId ?? null) : null);
  const savedOutcome = shouldLoadSavedReview
    ? resolveSavedReviewOutcome(toSavedReviewQueryState(savedReviewQuery), streamGone)
    : null;
  const savedOutcomeKind = savedOutcome?.kind ?? null;
  const savedErrorForReport = savedOutcome?.kind === "report-error" ? savedOutcome.error : null;
  const allowResumeWithoutSetup =
    isLiveNavigation || (shouldLoadSavedReview && savedOutcomeKind === "fallback-to-stream");

  const handleComplete = (data: ReviewCompleteData) => {
    setLiveState({ phase: "summary", reviewData: data });
  };

  const handleStreamNotFound = () => {
    setLiveState({ phase: "stream-not-found" });
  };

  const handleBack = () => {
    performBackAction(router, resolveBackAction(pathname, canGoBack));
  };

  // Every start failure the server can describe carries its own way out, so a
  // refused re-run offers that instead of a dead-end toast: the review already
  // running is opened, and a provider that needs configuring is one jump away.
  const reportRerunFailure = async (mode: Exclude<ReviewMode, "files">, error: unknown) => {
    const { title, message, recovery } = describeReviewStartError(error);
    const safeMessage = sanitizePresentationText(message);
    if (recovery === "open-active-review") {
      const session = await queryClient
        .fetchQuery(reviewQueries.activeSession(api, mode))
        .then((read) => read.session)
        .catch(() => null);
      if (session) {
        navigate({
          to: REVIEW_ROUTE,
          params: { reviewId: session.reviewId },
          search: { mode: session.mode, live: true },
          replace: true,
        });
        toast.info("Opened the Running Review", {
          message:
            "A review was already running, so Diffgazer opened it instead of starting a new one.",
        });
        return;
      }
    }
    // Error toasts persist until dismissed, so a start the providers screen can
    // fix carries the jump instead of leaving the user to find it.
    const toastId = toast.error(title, {
      message: safeMessage,
      action:
        recovery === "configure-provider" ? (
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              toast.dismiss(toastId);
              navigate({ to: "/settings/providers" });
            }}
          >
            Open Providers
          </Button>
        ) : undefined,
    });
  };

  // A run that found nothing is the one screen where re-running the same scope
  // is the obvious next move: the diff is still on disk and the verdict is one
  // keystroke from being re-checked. It replaces this route so Back does not
  // return to the run the new one supersedes.
  const runAgain = (mode: Exclude<ReviewMode, "files">) => {
    providerConsent.require(() => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      setIsStartingRerun(true);
      void (async () => {
        try {
          const { reviewId: nextReviewId } = await createReview.mutateAsync({ mode });
          navigate({
            to: REVIEW_ROUTE,
            params: { reviewId: nextReviewId },
            search: { mode, live: true },
            replace: true,
          });
        } catch (error) {
          await reportRerunFailure(mode, error);
        } finally {
          isStartingRef.current = false;
          setIsStartingRerun(false);
        }
      })();
    });
  };

  // A live run can re-run its own scope; a saved one describes a diff that has
  // moved on, so it only offers the list it was opened from. A file-picked run
  // is the exception: its selection is not on this screen, so re-running it
  // would silently review something else.
  const rerunMode = reviewMode === "files" ? null : reviewMode;
  const liveCleanRunActions: SummaryAction[] = [
    ...(rerunMode
      ? [
          {
            label: "Run Again",
            onSelect: () => runAgain(rerunMode),
            disabled: isStartingRerun,
          },
        ]
      : []),
    { label: "Back to Home", onSelect: () => navigate({ to: "/" }) },
  ];
  const savedCleanRunActions: SummaryAction[] = [
    { label: "Back to History", onSelect: () => navigate({ to: "/history" }) },
  ];

  useEffect(() => {
    if (savedOutcomeKind === "report-error" && reportErrorReportedRef.current !== nextRouteKey) {
      reportErrorReportedRef.current = nextRouteKey;
      handleApiError(savedErrorForReport);
    }
  }, [nextRouteKey, savedOutcomeKind, savedErrorForReport, handleApiError]);

  useEffect(() => {
    if (savedOutcomeKind === "not-found" && notFoundReportedRef.current !== nextRouteKey) {
      notFoundReportedRef.current = nextRouteKey;
      toast.error("Review Not Found", {
        message: "The live session has expired and no saved results are available.",
      });
      navigate({ to: "/" });
    }
  }, [nextRouteKey, savedOutcomeKind, navigate]);

  // `fallback-to-stream` is handled by deriving the streaming view below
  // (the live state falls back to a fresh stream), so it intentionally does
  // not short-circuit here.
  if (savedOutcome && savedOutcome.kind !== "fallback-to-stream") {
    // A failed run that never heard back from a lens has nothing to summarise:
    // the durable receipt is the whole story it can tell.
    if (savedOutcome.kind === "terminal" && !hasCompletedLens(savedOutcome.data.lensStats)) {
      return (
        <ReviewContainer
          terminalOutcome={savedOutcome.data.outcome}
          usageAvailability={savedOutcome.data.usageAvailability}
          onBack={handleBack}
        />
      );
    }
    // A run that reported lenses is worth reopening whether or not it finished.
    // A completed one that found something opens at its findings: reopening it
    // is a request to read them. A run that found nothing, and a failed one,
    // open at the summary, where the receipt and the remedy are told in full;
    // the terminal data carries the `outcome` it reports.
    if (savedOutcome.kind === "results" || savedOutcome.kind === "terminal") {
      const savedIssueId = resolveValidIssueId(savedOutcome.data.issues, initialIssueId);
      const failedOutcome =
        savedOutcome.kind === "terminal" ? savedOutcome.data.outcome : undefined;
      const hasFindings = savedOutcome.data.issues.length > 0;
      // Findings gate every path into the results screen, a hand-edited
      // `screen=results` included: a run with none has nothing there to read.
      const showResults =
        hasFindings &&
        (savedScreen === "results" ||
          (savedScreen === "auto" && (savedIssueId !== null || failedOutcome === undefined)));

      if (!showResults) {
        return (
          <ReviewSummaryView
            {...savedOutcome.data}
            cleanRunActions={savedCleanRunActions}
            onEnterReview={() => setSavedScreen("results")}
            onBack={handleBack}
          />
        );
      }
      return (
        <ReviewResultsView
          issues={savedOutcome.data.issues}
          reviewId={savedOutcome.data.reviewId}
          initialIssueId={savedIssueId}
          droppedDuplicates={savedOutcome.data.droppedDuplicates}
          lensStats={savedOutcome.data.lensStats}
          outcome={failedOutcome}
          // A completed run lands here directly — from History or a shared
          // issue link — so Escape leaves the route the way the user came in.
          // Results entered through a summary (failed runs, zero-issue runs)
          // keep that summary one keystroke away.
          onBackToSummary={
            savedScreen === "auto" && !failedOutcome ? undefined : () => setSavedScreen("summary")
          }
        />
      );
    }
    return <ReviewLoadingMessage message="Loading review..." />;
  }

  if (!reviewId) {
    return <ReviewLoadingMessage message="Redirecting..." />;
  }

  const currentLiveState =
    liveState && liveState.phase !== "stream-not-found"
      ? liveState
      : { phase: "streaming" as const, reviewId };

  switch (currentLiveState.phase) {
    case "streaming":
      return (
        <ReviewContainer
          key={reviewId}
          mode={reviewMode}
          allowResumeWithoutSetup={allowResumeWithoutSetup}
          onComplete={handleComplete}
          onStreamNotFound={handleStreamNotFound}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          {...currentLiveState.reviewData}
          cleanRunActions={liveCleanRunActions}
          onEnterReview={() =>
            setLiveState({ phase: "results", reviewData: currentLiveState.reviewData })
          }
          onBack={handleBack}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={currentLiveState.reviewData.issues}
          reviewId={currentLiveState.reviewData.reviewId}
          initialIssueId={resolveValidIssueId(currentLiveState.reviewData.issues, initialIssueId)}
          droppedDuplicates={currentLiveState.reviewData.droppedDuplicates}
          lensStats={currentLiveState.reviewData.lensStats}
          onBackToSummary={() =>
            setLiveState({ phase: "summary", reviewData: currentLiveState.reviewData })
          }
        />
      );
  }
}
