import { describeReviewStartError, type ReviewStartErrorDescription } from "@diffgazer/core/review";
import type { MenuAction } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Button } from "@diffgazer/ui/components/button";
import { toast } from "@diffgazer/ui/components/toast";
import type { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { ReviewFileScope } from "@/features/home/components/file-picker-dialog/dialog";
import { useIsMountedRef } from "@/hooks/use-is-mounted";

type Navigate = ReturnType<typeof useNavigate>;

export type CreateReview = (input: {
  mode: Exclude<ReviewMode, "files">;
  /** Pathspecs the review is narrowed to. Absent means the whole mode diff. */
  files?: string[];
}) => Promise<{ reviewId: string }>;

export type ResumableSession = { reviewId: string; mode: ReviewMode };

/**
 * A re-read that answered is tagged apart from one that could not: an
 * authoritative "no session" must not be papered over with the mount-time value.
 */
export type ActiveSessionRead =
  | { status: "read"; session: ResumableSession | null }
  | { status: "unreadable" };

export interface UseStartReviewOptions {
  navigate: Navigate;
  createReview: CreateReview;
  resumableSession: ResumableSession | null;
  /** Set when the active-session requests failed, so an absent session is unknown, not none. */
  isResumeUnavailable: boolean;
  /** Reads the live active session of either mode, so a refused start can open it. */
  refetchActiveSession: () => Promise<ActiveSessionRead>;
  /** Runs the start once the provider consent is on record, asking for it first when it is not. */
  requireProviderConsent: (action: () => void) => void;
}

/**
 * Everything a home review start has to survive: the row marked in flight, the
 * re-entrancy refusal, the refusal that means a review is already running, and
 * the resume of one. The screen keeps its keyboard and its layout; this keeps
 * the run.
 */
export function useStartReview({
  navigate,
  createReview,
  resumableSession,
  isResumeUnavailable,
  refetchActiveSession,
  requireProviderConsent,
}: UseStartReviewOptions) {
  // The action being started is what the menu renders, so that single value also
  // stands in for "in flight". A second activation can land before React
  // re-renders the menu as disabled, so re-entrancy is refused off a ref.
  const [startingAction, setStartingAction] = useState<MenuAction | null>(null);
  const isStartingRef = useRef(false);
  const isMountedRef = useIsMountedRef();

  const navigateToReview = (reviewId: string, mode: ReviewMode) => {
    navigate({
      to: "/review/{-$reviewId}",
      params: { reviewId },
      search: { mode, live: true },
    });
  };

  // The server refuses a second review while one is live. The running review is
  // what the user asked for, so the same mode opens it outright; another mode
  // cannot be swapped for it and is offered instead of forced.
  const openRunningReview = async (
    mode: Exclude<ReviewMode, "files">,
    refusal: ReviewStartErrorDescription,
  ) => {
    // A re-read that fails leaves the running review as unknown as it was before
    // it, so the refusal falls back to what the mount-time read already knew. A
    // re-read that answered is trusted outright, including its "none" — the
    // mount-time value may name a review that has since finished.
    const read = await refetchActiveSession().catch(
      (): ActiveSessionRead => ({ status: "unreadable" }),
    );
    const session = read.status === "unreadable" ? resumableSession : read.session;
    if (!isMountedRef.current) return;
    if (session === null) {
      toast.error(refusal.title, { message: refusal.message });
      return;
    }
    if (session.mode === mode) {
      navigateToReview(session.reviewId, mode);
      toast.info("Opened the Running Review", {
        message:
          "A review was already running, so Diffgazer opened it instead of starting a new one.",
      });
      return;
    }
    const toastId = toast.error(refusal.title, {
      message: `The running review covers ${session.mode} changes. Open it, or cancel it before starting one for ${mode} changes.`,
      action: (
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            toast.dismiss(toastId);
            navigateToReview(session.reviewId, session.mode);
          }}
        >
          Open Running Review
        </Button>
      ),
    });
  };

  const startReview = async (
    mode: Exclude<ReviewMode, "files">,
    action: MenuAction,
    files?: string[],
  ) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setStartingAction(action);
    try {
      const { reviewId } = await createReview({ mode, ...(files ? { files } : {}) });
      if (isMountedRef.current) navigateToReview(reviewId, mode);
    } catch (error) {
      if (!isMountedRef.current) return;
      const description = describeReviewStartError(error);
      if (description.recovery === "open-active-review") {
        await openRunningReview(mode, description);
        return;
      }
      const { title, message, recovery } = description;
      // Error toasts persist until dismissed, so a start the providers screen
      // can fix carries the jump instead of leaving the user to find it.
      const toastId = toast.error(title, {
        message,
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
    } finally {
      isStartingRef.current = false;
      setStartingAction(null);
    }
  };

  const resumeReview = () => {
    if (resumableSession) {
      navigateToReview(resumableSession.reviewId, resumableSession.mode);
      return;
    }
    if (isResumeUnavailable) {
      toast.error("Active Review Unavailable", {
        message: "The active review could not be read. Check History before starting a new one.",
      });
      return;
    }
    toast.warning("No Active Review", { message: "Start a new review from the menu." });
  };

  // The narrowed start is the menu's start with a pathspec filter: same consent
  // gate, same in-flight guard, same navigation. The row it marks as working is
  // the row whose diff was narrowed.
  const startFilteredReview = ({ mode, files }: { mode: ReviewFileScope; files?: string[] }) => {
    const action: MenuAction = mode === "staged" ? "review-staged" : "review-unstaged";
    requireProviderConsent(() => void startReview(mode, action, files));
  };

  return { startingAction, startReview, resumeReview, startFilteredReview };
}
