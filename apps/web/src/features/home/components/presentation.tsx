import type { ShutdownResult } from "@diffgazer/core/api";
import { usePageFooter } from "@diffgazer/core/footer";
import { useSubmitGuard } from "@diffgazer/core/forms";
import type { NavigableMenuAction } from "@diffgazer/core/navigation";
import { isMenuActionDisabled, resolveHomeMenuActivation } from "@diffgazer/core/navigation";
import { describeReviewStartError } from "@diffgazer/core/review";
import type { ContextInfo, MenuAction } from "@diffgazer/core/schemas/presentation";
import {
  MAIN_MENU_SHORTCUTS,
  MENU_ITEMS,
  TRUST_FOOTER_RIGHT_SHORTCUTS,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { useKey, useScope } from "@diffgazer/keys";
import { toast } from "@diffgazer/ui/components/toast";
import type { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { TRUST_PANEL_FOOTER_SHORTCUTS, TrustPanel } from "@/components/shared/trust-panel";
import { ContextSidebar } from "@/features/home/components/context-sidebar";
import { HomeMenu } from "@/features/home/components/menu";
import {
  HISTORY_DATE_KEY,
  HISTORY_RUN_KEY,
  SETTINGS_HIGHLIGHTED_KEY,
} from "@/hooks/use-scoped-route-state";
import { reportShutdownResult } from "@/lib/shutdown";

type Navigate = ReturnType<typeof useNavigate>;
type CreateReview = (input: { mode: ReviewMode }) => Promise<{ reviewId: string }>;
type ResumableSession = { reviewId: string; mode: ReviewMode };

type RouteConfig = { to: string; search?: Record<string, string> };
const MENU_ITEM_IDS = new Set<string>(MENU_ITEMS.map((item) => item.id));

function getHomeMenuHighlighted(value: string | null): string | null {
  if (!value) return value;
  if (MENU_ITEM_IDS.has(value)) return value;
  return MENU_ITEMS[0]?.id ?? null;
}

const MENU_ROUTES: Record<NavigableMenuAction, RouteConfig> = {
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
  context: ContextInfo;
  isTrusted: boolean;
  needsTrust: boolean;
  projectId: string | null;
  repoRoot: string | null;
  resumableSession: ResumableSession | null;
  highlighted: string | null;
  searchError: string | undefined;
  onHighlightChange: (id: string | null) => void;
  navigate: Navigate;
  createReview: CreateReview;
  clearScopedRouteState: (scope: string, key: string) => void;
  shutdown: () => Promise<ShutdownResult>;
}

export function HomePagePresentation({
  context,
  isTrusted,
  needsTrust,
  projectId,
  repoRoot,
  resumableSession,
  highlighted,
  searchError,
  onHighlightChange,
  navigate,
  createReview,
  clearScopedRouteState,
  shutdown,
}: HomePagePresentationProps) {
  const { isSubmitting: isStartingReview, withGuard } = useSubmitGuard();
  const hasResumableSession = resumableSession != null;
  // Starting a review outlives this page: app-wide keys can leave home while the
  // request is in flight, and a late navigate would pull the user off the screen
  // they chose.
  const isMountedRef = useRef(true);
  const invalidIdReportedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (searchError !== "invalid-review-id") {
      // Re-arm once the redirect cleaned the search param, so a second bad link
      // in the same session is reported and cleaned too.
      invalidIdReportedRef.current = false;
      return;
    }
    if (invalidIdReportedRef.current) return;
    invalidIdReportedRef.current = true;
    toast.error("Invalid Review ID", { message: "The review ID format is invalid." });
    navigate({ to: "/", replace: true });
  }, [searchError, navigate]);

  const effectiveHighlighted = getHomeMenuHighlighted(highlighted);

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

  const startReview = (mode: ReviewMode) =>
    withGuard(async () => {
      try {
        const { reviewId } = await createReview({ mode });
        if (isMountedRef.current) navigateToReview(reviewId, mode);
      } catch (error) {
        if (!isMountedRef.current) return;
        const { title, message } = describeReviewStartError(error);
        toast.error(title, { message });
      }
    });

  const resumeReview = () => {
    if (!resumableSession) {
      toast.warning("No Active Review", { message: "Start a new review from the menu." });
      return;
    }
    navigateToReview(resumableSession.reviewId, resumableSession.mode);
  };

  const navigateToMenuTarget = (target: NavigableMenuAction) => {
    const route = MENU_ROUTES[target];
    for (const key of MENU_ROUTE_SCOPED_KEYS[target]) {
      clearScopedRouteState(route.to, key);
    }
    navigate({ to: route.to, search: route.search });
  };

  const handleActivate = (id: string) => {
    if (!MENU_ITEM_IDS.has(id)) return;

    const decision = resolveHomeMenuActivation(id as MenuAction, {
      isTrusted,
      hasResumableSession,
    });

    switch (decision.kind) {
      case "start-review":
        void startReview(decision.mode);
        return;
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

  // The trust prompt replaces the menu only when there is a project to grant it
  // for; without one the menu renders instead, with every item already disabled.
  // Footer copy and the jump keys follow that same branch.
  const showsTrustPanel = needsTrust && projectId !== null && repoRoot !== null;

  usePageFooter({
    shortcuts: showsTrustPanel
      ? [...TRUST_PANEL_FOOTER_SHORTCUTS, { key: "q", label: "Quit" }]
      : MAIN_MENU_SHORTCUTS,
    rightShortcuts: showsTrustPanel ? TRUST_FOOTER_RIGHT_SHORTCUTS : [],
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

  useKey(
    {
      r: () => activateShortcut("review-unstaged"),
      R: () => activateShortcut("review-staged"),
      l: () => activateShortcut("resume-review"),
      o: openLastRun,
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
            highlighted={effectiveHighlighted}
            onHighlightChange={onHighlightChange}
            onSelect={handleActivate}
            items={MENU_ITEMS}
            isTrusted={isTrusted}
            hasResumableSession={hasResumableSession}
            pending={isStartingReview}
          />
          {/* Menu first in source order so the actionable pane leads the stacked
              layout; the context column returns to the left at desktop. */}
          <ContextSidebar
            context={context}
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
