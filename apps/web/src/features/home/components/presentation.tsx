import type { ShutdownResult } from "@diffgazer/core/api";
import { usePageFooter } from "@diffgazer/core/footer";
import type { NavigableMenuAction } from "@diffgazer/core/navigation";
import { resolveHomeMenuActivation } from "@diffgazer/core/navigation";
import { describeReviewStartError } from "@diffgazer/core/review";
import type { ContextInfo, MenuAction } from "@diffgazer/core/schemas/presentation";
import {
  MAIN_MENU_SHORTCUTS,
  MENU_ITEMS,
  TRUST_FOOTER_RIGHT_SHORTCUTS,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { useScope } from "@diffgazer/keys";
import { toast } from "@diffgazer/ui/components/toast";
import type { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TRUST_PANEL_FOOTER_SHORTCUTS, TrustPanel } from "@/components/shared/trust-panel";
import { ContextSidebar } from "@/features/home/components/context-sidebar";
import { HomeMenu } from "@/features/home/components/menu";

type Navigate = ReturnType<typeof useNavigate>;
type CreateReview = (input: { mode: ReviewMode }) => Promise<{ reviewId: string }>;
type ResumableSession = { reviewId: string; mode: ReviewMode };

type RouteConfig = { to: string; search?: Record<string, string> };
const MENU_ITEM_IDS = new Set<string>(MENU_ITEMS.map((item) => item.id));

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
  history: ["run", "date"],
  settings: ["highlighted"],
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
  const [isStartingReview, setIsStartingReview] = useState(false);
  const hasResumableSession = resumableSession != null;
  const activeReviewRequestRef = useRef<symbol | null>(null);
  const invalidIdReportedRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeReviewRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (searchError !== "invalid-review-id" || invalidIdReportedRef.current) return;
    invalidIdReportedRef.current = true;
    toast.error("Invalid Review ID", { message: "The review ID format is invalid." });
    navigate({ to: "/", replace: true });
  }, [searchError, navigate]);

  const effectiveHighlighted = (() => {
    if (!highlighted) return highlighted;
    if (MENU_ITEM_IDS.has(highlighted)) return highlighted;
    return MENU_ITEMS[0]?.id ?? null;
  })();

  const handleQuit = async () => {
    const result = await shutdown();
    if (result.status === "closed") return;

    const variant = result.status === "error" ? "error" : "warning";
    const title = result.status === "error" ? "Quit Failed" : "Close Tab Manually";
    toast[variant](title, { message: result.message });
  };

  const navigateToReview = (reviewId: string, mode: ReviewMode) => {
    navigate({
      to: "/review/{-$reviewId}",
      params: { reviewId },
      search: { mode, live: true },
    });
  };

  const startReview = async (mode: ReviewMode) => {
    if (activeReviewRequestRef.current) return;
    const request = Symbol();
    activeReviewRequestRef.current = request;
    setIsStartingReview(true);

    const finishCurrentRequest = () => {
      if (!isMountedRef.current || activeReviewRequestRef.current !== request) return false;
      activeReviewRequestRef.current = null;
      setIsStartingReview(false);
      return true;
    };

    try {
      const { reviewId } = await createReview({ mode });
      if (!finishCurrentRequest()) return;
      navigateToReview(reviewId, mode);
    } catch (error) {
      if (!finishCurrentRequest()) return;
      const { title, message } = describeReviewStartError(error);
      toast.error(title, { message });
    }
  };

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

  usePageFooter({
    shortcuts: needsTrust
      ? [...TRUST_PANEL_FOOTER_SHORTCUTS, { key: "q", label: "Quit" }]
      : MAIN_MENU_SHORTCUTS,
    rightShortcuts: needsTrust ? TRUST_FOOTER_RIGHT_SHORTCUTS : [],
  });
  useScope("home");

  if (needsTrust && projectId && repoRoot) {
    return <TrustPanel directory={repoRoot} />;
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 overflow-auto">
      <ContextSidebar
        context={context}
        isTrusted={isTrusted}
        projectPath={repoRoot ?? undefined}
        pending={isStartingReview}
      />
      <HomeMenu
        highlighted={effectiveHighlighted}
        onHighlightChange={onHighlightChange}
        onSelect={handleActivate}
        items={MENU_ITEMS}
        isTrusted={isTrusted}
        hasResumableSession={hasResumableSession}
        pending={isStartingReview}
      />
    </div>
  );
}
