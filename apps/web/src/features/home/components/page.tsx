import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ContextInfo, MenuAction } from "@diffgazer/core/schemas/ui";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { useActiveReviewSession, useApi, useCreateReview } from "@diffgazer/core/api/hooks";
import { isApiError } from "@diffgazer/core/api";
import { deriveTrustStatus, isReviewStartAction } from "@diffgazer/core/navigation";
import { MAIN_MENU_SHORTCUTS, MENU_ITEMS } from "@diffgazer/core/schemas/ui";
import { useKey, useScope } from "@diffgazer/keys";
import { useScopedRouteState, clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@diffgazer/core/footer";
import { ContextSidebar } from "@/features/home/components/context-sidebar";
import { HomeMenu } from "@/features/home/components/home-menu";
import { useConfigData } from "@/app/providers/config-provider";
import { useReviewHistory } from "@/features/history/hooks/use-review-history";
import { toast } from "@diffgazer/ui/components/toast";
import { shutdown } from "@/features/home/utils/shutdown";
import { TrustPanel } from "./trust-panel";

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

function getMainMenuHighlighted(value: string | null): string | null {
  if (!value) return value;
  if (MAIN_MENU_ITEM_IDS.has(value)) return value;
  return MAIN_MENU_ITEMS[0]?.id ?? null;
}

export function HomePage() {
  const { provider, model, trust, repoRoot, projectId } = useConfigData();
  const { reviews } = useReviewHistory();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const api = useApi();
  const createReview = useCreateReview();
  const [isStartingReview, setIsStartingReview] = useState(false);

  const { isTrusted, needsTrust } = deriveTrustStatus({ trust, projectId, repoRoot });
  const unstagedActive = useActiveReviewSession("unstaged");
  const stagedActive = useActiveReviewSession("staged");
  const hasResumableSession =
    unstagedActive.data?.session != null || stagedActive.data?.session != null;

  useEffect(() => {
    if (search.error !== "invalid-review-id") return;
    toast.error("Invalid Review ID", { message: "The review ID format is invalid." });
    navigate({ to: "/", replace: true });
  }, [search.error, navigate]);

  const mostRecentReview = reviews[0];
  const context: ContextInfo = {
    providerName: provider,
    providerMode: model,
    lastRunId: mostRecentReview?.id,
    lastRunIssueCount: mostRecentReview?.issueCount,
    trustedDir: isTrusted ? trust?.repoRoot : undefined,
  };

  const [highlighted, setHighlighted] = useScopedRouteState<string | null>(
    "highlighted",
    MAIN_MENU_ITEMS[0]?.id ?? null
  );
  const effectiveHighlighted = getMainMenuHighlighted(highlighted);

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
      const { reviewId } = await createReview.mutateAsync({ mode });
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
      const active = await api.getActiveReviewSession("unstaged");
      if (active.session) {
        navigateToReview(active.session.reviewId, active.session.mode);
        return;
      }
      const stagedActive = await api.getActiveReviewSession("staged");
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
          { key: "h", label: "Help" },
        ]
      : [],
  });
  useScope("home");
  useKey("q", () => {
    void handleQuit();
  });
  useKey("s", () => navigate({ to: "/settings" }));
  useKey("h", () => handleActivate("help"));

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
        onHighlightChange={setHighlighted}
        onSelect={handleActivate}
        items={MAIN_MENU_ITEMS}
        isTrusted={isTrusted}
        hasResumableSession={hasResumableSession}
      />
    </div>
  );
}
