import { useEffect, useState } from "react";
import type { useNavigate } from "@tanstack/react-router";
import type { ContextInfo, MenuAction, Shortcut } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { isApiError, type ShutdownResult } from "@diffgazer/core/api";
import { isReviewStartAction } from "@diffgazer/core/navigation";
import { MAIN_MENU_SHORTCUTS, MENU_ITEMS } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { usePageFooter } from "@diffgazer/core/footer";
import { toast } from "@diffgazer/ui/components/toast";
import { ContextSidebar } from "@/features/home/components/context-sidebar";
import { HomeMenu } from "@/features/home/components/home-menu";
import { TrustPanel } from "./trust-panel";

type Navigate = ReturnType<typeof useNavigate>;
type CreateReview = (input: { mode: ReviewMode }) => Promise<{ reviewId: string }>;
type GetActiveReviewSession = (
  mode: ReviewMode,
) => Promise<{ session: { reviewId: string; mode: ReviewMode } | null }>;

type RouteConfig = { to: string; search?: Record<string, string> };
const MAIN_MENU_ITEMS = MENU_ITEMS.filter((item) => item.id !== "help");
const MAIN_MENU_ITEM_IDS = new Set<string>(MAIN_MENU_ITEMS.map((item) => item.id));

function describeReviewStartError(error: unknown): { title: string; message: string } {
  if (isApiError(error)) {
    switch (error.code) {
      case "API_KEY_MISSING":
        return {
          title: "API Key Missing",
          message: `${error.message}. Add one in Settings → Providers.`,
        };
      case "UNSUPPORTED_PROVIDER":
        return {
          title: "Provider Not Configured",
          message: "Pick an AI provider in Settings → Providers.",
        };
      case "MODEL_ERROR":
        return {
          title: "Model Not Selected",
          message: error.message,
        };
    }
    return { title: "Failed to Start Review", message: error.message };
  }
  return {
    title: "Failed to Start Review",
    message: "Could not create a review session.",
  };
}

const REVIEW_MODES: Partial<Record<MenuAction, ReviewMode>> = {
  "review-unstaged": "unstaged",
  "review-staged": "staged",
};

const MENU_ROUTES: Partial<Record<MenuAction, RouteConfig>> = {
  history: { to: "/history" },
  settings: { to: "/settings" },
  help: { to: "/help" },
};

export interface HomePagePresentationProps {
  context: ContextInfo;
  isTrusted: boolean;
  needsTrust: boolean;
  projectId: string | null;
  repoRoot: string | null;
  hasResumableSession: boolean;
  highlighted: string | null;
  searchError: string | undefined;
  onHighlightChange: (id: string | null) => void;
  navigate: Navigate;
  createReview: CreateReview;
  getActiveReviewSession: GetActiveReviewSession;
  clearScopedRouteState: (scope: string, key: string) => void;
  shutdown: () => Promise<ShutdownResult>;
}

export function HomePagePresentation({
  context,
  isTrusted,
  needsTrust,
  projectId,
  repoRoot,
  hasResumableSession,
  highlighted,
  searchError,
  onHighlightChange,
  navigate,
  createReview,
  getActiveReviewSession,
  clearScopedRouteState,
  shutdown,
}: HomePagePresentationProps) {
  const [isStartingReview, setIsStartingReview] = useState(false);

  useEffect(() => {
    if (searchError !== "invalid-review-id") return;
    toast.error("Invalid Review ID", { message: "The review ID format is invalid." });
    navigate({ to: "/", replace: true });
  }, [searchError, navigate]);

  const effectiveHighlighted = (() => {
    if (!highlighted) return highlighted;
    if (MAIN_MENU_ITEM_IDS.has(highlighted)) return highlighted;
    return MAIN_MENU_ITEMS[0]?.id ?? null;
  })();

  const handleQuit = async () => {
    const result = await shutdown();
    if (result.status === "closed") return;

    const variant = result.status === "error" ? "error" : "warning";
    const title = result.status === "error" ? "Quit Failed" : "Close Tab Manually";
    toast[variant](title, { message: result.message });
  };

  const navigateToReview = (reviewId: string, mode: ReviewMode) => {
    clearScopedRouteState("/review", "highlighted");
    navigate({
      to: "/review/{-$reviewId}",
      params: { reviewId },
      search: { mode, live: true },
    });
  };

  const startReview = async (mode: ReviewMode) => {
    if (isStartingReview) return;
    setIsStartingReview(true);
    try {
      const { reviewId } = await createReview({ mode });
      navigateToReview(reviewId, mode);
    } catch (error) {
      const { title, message } = describeReviewStartError(error);
      toast.error(title, { message });
    } finally {
      setIsStartingReview(false);
    }
  };

  const resumeReview = async () => {
    if (isStartingReview) return;
    setIsStartingReview(true);
    try {
      const active = await getActiveReviewSession("unstaged");
      if (active.session) {
        navigateToReview(active.session.reviewId, active.session.mode);
        return;
      }
      const stagedActive = await getActiveReviewSession("staged");
      if (stagedActive.session) {
        navigateToReview(stagedActive.session.reviewId, stagedActive.session.mode);
        return;
      }
      toast.warning("No Active Review", { message: "Start a new review from the menu." });
    } catch {
      toast.error("Failed to Resume Review", { message: "Could not find an active session." });
    } finally {
      setIsStartingReview(false);
    }
  };

  const handleActivate = (id: string) => {
    if (!MAIN_MENU_ITEM_IDS.has(id) && id !== "help") return;
    const action = id as MenuAction;

    if (action === "quit") {
      void handleQuit();
      return;
    }

    if (isReviewStartAction(action) && !isTrusted) {
      toast.error("Directory Not Trusted", { message: "Grant permissions in Settings → Trust & Permissions first." });
      return;
    }

    const reviewMode = REVIEW_MODES[action];
    if (reviewMode) {
      void startReview(reviewMode);
      return;
    }

    if (action === "resume-review") {
      if (!hasResumableSession) return;
      void resumeReview();
      return;
    }

    const route = MENU_ROUTES[action];
    if (route) {
      clearScopedRouteState(route.to, "highlighted");
      navigate({ to: route.to, search: route.search });
    }
  };

  const trustFooterShortcuts: Shortcut[] = [
    { key: "↑/↓", label: "Navigate Permissions" },
    { key: "Enter/Space", label: "Toggle Permission" },
    { key: "q", label: "Quit" },
  ];

  usePageFooter({
    shortcuts: needsTrust ? trustFooterShortcuts : MAIN_MENU_SHORTCUTS,
    rightShortcuts: needsTrust
      ? [
          { key: "s", label: "Settings" },
          { key: "?", label: "Help" },
        ]
      : [],
  });
  useScope("home");
  useKey("q", () => {
    void handleQuit();
  });
  useKey("s", () => navigate({ to: "/settings" }));
  useKey("h", () => handleActivate("history"));

  useKey("shift+?", () => handleActivate("help"));

  if (needsTrust && projectId && repoRoot) {
    return <TrustPanel directory={repoRoot} projectId={projectId} />;
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 overflow-auto">
      <ContextSidebar
        context={context}
        isTrusted={isTrusted}
        projectPath={repoRoot ?? undefined}
      />
      <HomeMenu
        highlighted={effectiveHighlighted}
        onHighlightChange={onHighlightChange}
        onSelect={handleActivate}
        items={MAIN_MENU_ITEMS}
        isTrusted={isTrusted}
        hasResumableSession={hasResumableSession}
      />
    </div>
  );
}
