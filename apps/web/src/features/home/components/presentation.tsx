import { usePageFooter } from "@diffgazer/core/footer";
import type { NavigableMenuAction } from "@diffgazer/core/navigation";
import { isMenuActionDisabled, resolveHomeMenuActivation } from "@diffgazer/core/navigation";
import { describeReviewStartError, type ReviewStartErrorDescription } from "@diffgazer/core/review";
import type { HomeContextInfo, MenuAction, Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  MAIN_MENU_SHORTCUTS,
  MENU_ITEMS,
  TRUST_PERMISSION_SHORTCUTS,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { DECLINE, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { toast } from "@diffgazer/ui/components/toast";
import type { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TrustPanel } from "@/components/shared/trust-panel";
import { ContextSidebar } from "@/features/home/components/context-sidebar";
import { HomeMenu } from "@/features/home/components/menu";
import { useIsMountedRef } from "@/hooks/use-is-mounted";
import {
  HISTORY_DATE_KEY,
  HISTORY_RUN_KEY,
  SETTINGS_HIGHLIGHTED_KEY,
} from "@/hooks/use-scoped-route-state";
import { INVALID_REVIEW_ID_COPY } from "@/lib/review-error-copy";
import { reportShutdownResult, type ShutdownResult } from "@/lib/shutdown";

type Navigate = ReturnType<typeof useNavigate>;
type CreateReview = (input: {
  mode: Exclude<ReviewMode, "files">;
}) => Promise<{ reviewId: string }>;
type ResumableSession = { reviewId: string; mode: ReviewMode };
/**
 * A re-read that answered is tagged apart from one that could not: an
 * authoritative "no session" must not be papered over with the mount-time value.
 */
export type ActiveSessionRead =
  | { status: "read"; session: ResumableSession | null }
  | { status: "unreadable" };

// The trust prompt hides the menu, so the web footer keeps advertising the two
// app-wide jump keys it would otherwise show as menu rows. The TUI trust panel
// has no such right-hand footer, so these stay web-local.
const TRUST_PANEL_JUMP_SHORTCUTS: Shortcut[] = [
  { key: "s", label: "Settings" },
  { key: "?", label: "Help" },
];

const MENU_ROUTES: Record<NavigableMenuAction, { to: string }> = {
  history: { to: "/history" },
  settings: { to: "/settings" },
  help: { to: "/help" },
};

// The scoped-route-state keys each target page actually stores, so navigating
// there from the menu resets that page's selection instead of clearing keys it
// never writes (history keeps "run"/"date"; settings keeps "highlighted"; help
// stores nothing).
const MENU_ROUTE_SCOPED_KEYS: Record<NavigableMenuAction, readonly string[]> = {
  history: [HISTORY_RUN_KEY, HISTORY_DATE_KEY],
  settings: [SETTINGS_HIGHLIGHTED_KEY],
  help: [],
};

export interface HomePagePresentationProps {
  context: HomeContextInfo;
  isTrusted: boolean;
  needsTrust: boolean;
  repoRoot: string | null;
  resumableSession: ResumableSession | null;
  /** Set when the active-session requests failed, so an absent session is unknown, not none. */
  isResumeUnavailable?: boolean;
  /** Reads the live active session of either mode, so a refused start can open it. */
  refetchActiveSession: () => Promise<ActiveSessionRead>;
  highlighted: MenuAction | null;
  searchError: string | undefined;
  onHighlightChange: (id: MenuAction | null) => void;
  navigate: Navigate;
  createReview: CreateReview;
  /** Runs the start once the provider consent is on record, asking for it first when it is not. */
  requireProviderConsent: (action: () => void) => void;
  clearScopedRouteState: (scope: string, key: string) => void;
  shutdown: () => Promise<ShutdownResult>;
}

export function HomePagePresentation({
  context,
  isTrusted,
  needsTrust,
  repoRoot,
  resumableSession,
  isResumeUnavailable = false,
  refetchActiveSession,
  highlighted,
  searchError,
  onHighlightChange,
  navigate,
  createReview,
  requireProviderConsent,
  clearScopedRouteState,
  shutdown,
}: HomePagePresentationProps) {
  // The action being started is what the menu renders, so that single value also
  // stands in for "in flight". A second activation can land before React
  // re-renders the menu as disabled, so re-entrancy is refused off a ref.
  const [startingAction, setStartingAction] = useState<MenuAction | null>(null);
  const isStartingRef = useRef(false);
  const isStartingReview = startingAction !== null;
  // A failed active-session request proves nothing about whether a run is live,
  // so the row stays reachable and says it cannot tell rather than holding
  // itself shut behind "there is nothing to resume".
  const hasResumableSession = resumableSession != null || isResumeUnavailable;
  const isMountedRef = useIsMountedRef();
  const invalidIdReportedRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (searchError !== "invalid-review-id") {
      // Re-arm once the redirect cleaned the search param, so a second bad link
      // in the same session is reported and cleaned too.
      invalidIdReportedRef.current = false;
      return;
    }
    if (invalidIdReportedRef.current) return;
    invalidIdReportedRef.current = true;
    toast.error(INVALID_REVIEW_ID_COPY.title, { message: INVALID_REVIEW_ID_COPY.message });
    navigate({ to: "/", replace: true });
  }, [searchError, navigate]);

  const handleQuit = async () => {
    reportShutdownResult(await shutdown());
  };

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

  const startReview = async (mode: Exclude<ReviewMode, "files">, action: MenuAction) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setStartingAction(action);
    try {
      const { reviewId } = await createReview({ mode });
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

  const navigateToMenuTarget = (target: NavigableMenuAction) => {
    const route = MENU_ROUTES[target];
    for (const key of MENU_ROUTE_SCOPED_KEYS[target]) {
      clearScopedRouteState(route.to, key);
    }
    navigate({ to: route.to });
  };

  const handleActivate = (id: MenuAction) => {
    const decision = resolveHomeMenuActivation(id, { isTrusted, hasResumableSession });

    switch (decision.kind) {
      case "start-review": {
        // The start turns the sidebar inert — at once, or after the consent
        // notice this may first open. Focus resting on one of its actions would
        // be dropped onto the body when that happens (and the notice would
        // capture the doomed row as its restore target), so the menu takes
        // custody before either. Focus sitting anywhere else was placed
        // deliberately and is left alone.
        const sidebar = sidebarRef.current;
        if (sidebar?.contains(sidebar.ownerDocument.activeElement)) {
          menuRef.current?.focus();
        }
        requireProviderConsent(() => void startReview(decision.mode, id));
        return;
      }
      case "resume":
        resumeReview();
        return;
      case "navigate":
        navigateToMenuTarget(decision.target);
        return;
      case "quit":
        void handleQuit();
        return;
      case "blocked-untrusted":
        toast.error("Repository Not Trusted", {
          message: "Grant permissions in Settings → Trust & Permissions first.",
        });
        return;
      case "noop":
        return;
      default: {
        const _exhaustive: never = decision;
        return _exhaustive;
      }
    }
  };

  // The trust prompt replaces the menu when there is a repo to grant trust for;
  // without one the menu renders instead, with every item already disabled.
  // Footer copy and the jump keys follow that same branch.
  const showsTrustPanel = needsTrust && repoRoot !== null;

  usePageFooter({
    shortcuts: showsTrustPanel
      ? [...TRUST_PERMISSION_SHORTCUTS, { key: "q", label: "Quit" }]
      : MAIN_MENU_SHORTCUTS,
    rightShortcuts: showsTrustPanel ? TRUST_PANEL_JUMP_SHORTCUTS : [],
  });
  useScope("home");

  // Every menu item advertises its jump key, matching the TUI home menu. The
  // navigation letters (h/s/?/q) are already bound app-wide, so only the review
  // letters register here; both surfaces resolve them through the same
  // disabled/activation rules a click goes through.
  const activateShortcut = (id: MenuAction) => {
    if (isStartingReview) return;
    if (isMenuActionDisabled(id, { isTrusted, hasResumableSession })) return;
    handleActivate(id);
  };

  // Opening the run you just made is the most likely next action on home, and
  // its id is already printed in the CONTEXT panel - so the row is a real
  // action, reachable by click and by [o], with the same guards as r/R/l.
  const openLastRun = () => {
    if (isStartingReview || context.lastRunId === undefined) return;
    void navigate({
      to: "/review/{-$reviewId}",
      params: { reviewId: context.lastRunId },
    });
  };

  // The sidebar's settings rows carry the same jump treatment as [o]: t and p
  // reach them without Tab-walking the panel, behind the guards a click on the
  // row goes through. t follows the trust row — inert once the repo is trusted.
  const openSettingsRow = (to: "/settings/providers" | "/settings/trust-permissions") => {
    if (isStartingReview) return;
    void navigate({ to });
  };

  useKey(
    {
      r: () => activateShortcut("review-unstaged"),
      R: () => activateShortcut("review-staged"),
      l: () => activateShortcut("resume-review"),
      o: openLastRun,
      p: () => openSettingsRow("/settings/providers"),
      t: () => {
        if (isTrusted) return DECLINE;
        openSettingsRow("/settings/trust-permissions");
        return;
      },
    },
    { enabled: !showsTrustPanel },
  );

  if (showsTrustPanel) {
    return <TrustPanel directory={repoRoot} />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 md:p-6 lg:p-8">
      {/* Spare height splits 1:2 around the panes: they sit in the optical band
          below the hero wordmark — neither glued to it nor sunk to dead center —
          and the spacers collapse once the column overflows, so a short window
          scrolls from the top. */}
      <div aria-hidden className="grow" />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {/* At desktop each pane keeps its own height instead of stretching to one
            bottom line, so the shorter context pane carries no dead band; below lg
            the cross axis is horizontal and the default stretch keeps both panes
            full width. */}
        <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start">
          <HomeMenu
            menuRef={menuRef}
            highlighted={highlighted}
            onHighlightChange={onHighlightChange}
            onSelect={handleActivate}
            items={MENU_ITEMS}
            isTrusted={isTrusted}
            hasResumableSession={hasResumableSession}
            pendingAction={startingAction}
          />
          {/* Menu first in source order so the actionable pane leads the stacked
              layout; the context column returns to the left at desktop. */}
          <ContextSidebar
            ref={sidebarRef}
            context={context}
            navigate={navigate}
            isTrusted={isTrusted}
            projectPath={repoRoot ?? undefined}
            pending={isStartingReview}
            onOpenLastRun={context.lastRunId === undefined ? undefined : openLastRun}
          />
        </div>
      </div>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
