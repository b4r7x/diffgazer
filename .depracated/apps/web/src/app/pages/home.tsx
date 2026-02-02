import { useMemo, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { MAIN_MENU_SHORTCUTS } from "@repo/core";
import { useScope, useKey } from "@/hooks/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { ContextSidebar, HomeMenu } from "@/features/home/components";
import { useConfig } from "@/features/settings";
import { useReviewHistory } from "@/features/review";
import { useToast } from "@/components/ui/toast";
import type { ContextInfo } from "@repo/schemas/ui";
import { api } from "@/lib/api";

type RouteConfig = { to: string; search?: Record<string, string> };

const MENU_ROUTES: Record<string, RouteConfig> = {
  "review-unstaged": { to: "/review" },
  "review-staged": { to: "/review", search: { mode: "staged" } },
  // TODO: future feature - file selection UI not implemented
  // "review-files": { to: "/review", search: { mode: "files" } },
  "resume-review": { to: "/review" },
  history: { to: "/history" },
  settings: { to: "/settings" },
};

export function HomePage() {
  const { provider, model, trust, repoRoot } = useConfig();
  const { reviews } = useReviewHistory();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { error?: string };

  const isTrusted = trust !== null;
  const hasLastReview = reviews.length > 0;

  useEffect(() => {
    if (search.error === 'invalid-review-id') {
      showToast({
        variant: "error",
        title: "Invalid Review ID",
        message: "The review ID format is invalid.",
      });
      navigate({ to: '/', replace: true });
    }
  }, [search.error, showToast, navigate]);

  const context: ContextInfo = useMemo(() => {
    const mostRecentReview = reviews[0];
    return {
      providerName: provider,
      providerMode: model,
      lastRunId: mostRecentReview?.id,
      lastRunIssueCount: mostRecentReview?.issueCount,
      trustedDir: trust?.repoRoot,
    };
  }, [provider, model, reviews, trust]);
  const [selectedIndex, setSelectedIndex] = useScopedRouteState('menuIndex', 0);

  usePageFooter({ shortcuts: MAIN_MENU_SHORTCUTS });

  const handleActivate = (id: string) => {
    if (id === "quit") {
      handleQuit();
      return;
    }

    const reviewActions = ["review-unstaged", "review-staged", "review-files"];
    if (reviewActions.includes(id) && !isTrusted) {
      showToast({
        variant: "error",
        title: "Directory Not Trusted",
        message: "Grant permissions in Settings → Trust & Permissions first.",
      });
      return;
    }

    const route = MENU_ROUTES[id];
    if (route) {
      navigate({ to: route.to, search: route.search });
    }
  };

  const handleQuit = async () => {
    try {
      await api.post("/shutdown", {});
    } catch {
      // Server terminates before responding
    }
    window.close();
  };

  useScope("home");
  useKey("q", handleQuit);
  useKey("s", () => navigate({ to: "/settings" }));
  useKey("h", () => handleActivate("help"));

  return (
    <div className="flex flex-1 flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 overflow-auto">
      <ContextSidebar context={context} isTrusted={isTrusted} projectPath={repoRoot ?? undefined} />
      <HomeMenu
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onActivate={handleActivate}
        isTrusted={isTrusted}
        hasLastReview={hasLastReview}
      />
    </div>
  );
}
