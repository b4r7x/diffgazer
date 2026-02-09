import { useEffect, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ContextInfo } from "@diffgazer/schemas/ui";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { MAIN_MENU_SHORTCUTS, MENU_ITEMS } from "@/config/navigation";
import { useKey, useScope, useNavigation } from "@diffgazer/keyboard";
import { useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { ContextSidebar } from "@/features/home/components/context-sidebar";
import { HomeMenu } from "@/features/home/components/home-menu";
import { useConfigData } from "@/app/providers/config-provider";
import { useReviewHistory } from "@/features/history/hooks/use-review-history";
import { useToast } from "@diffgazer/ui";
import { shutdown } from "@/features/home/utils/shutdown";
import { TrustPanel } from "./trust-panel";

type RouteConfig = { to: string; search?: Record<string, string> };
const SHOW_HELP_IN_MAIN_MENU = false;
const MAIN_MENU_ITEMS = SHOW_HELP_IN_MAIN_MENU
  ? MENU_ITEMS
  : MENU_ITEMS.filter((item) => item.id !== "help");

const MENU_ROUTES: Record<string, RouteConfig> = {
  "review-unstaged": { to: "/review" },
  "review-staged": { to: "/review", search: { mode: "staged" } },
  "resume-review": { to: "/review" },
  history: { to: "/history" },
  settings: { to: "/settings" },
  help: { to: "/help" },
};

export function HomePage() {
  const { provider, model, trust, repoRoot, projectId } = useConfigData();
  const { reviews } = useReviewHistory();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });

  const isTrusted = Boolean(trust?.capabilities.readFiles);
  const hasLastReview = reviews.length > 0;

  // Show error toast for invalid review ID in search params (once only)
  const errorShownRef = useRef(false);
  useEffect(() => {
    if (search.error !== "invalid-review-id") return;
    if (errorShownRef.current) return;
    errorShownRef.current = true;
    showToast({
      variant: "error",
      title: "Invalid Review ID",
      message: "The review ID format is invalid.",
    });
    navigate({ to: "/", replace: true });
  }, [search.error, showToast, navigate]);

  const needsTrust = Boolean(projectId && repoRoot && trust === null);

  const mostRecentReview = reviews[0];
  const context: ContextInfo = {
    providerName: provider,
    providerMode: model,
    lastRunId: mostRecentReview?.id,
    lastRunIssueCount: mostRecentReview?.issueCount,
    trustedDir: isTrusted ? trust?.repoRoot : undefined,
  };

  const [selectedId, setSelectedId] = useScopedRouteState<string | null>(
    "menuId",
    MAIN_MENU_ITEMS[0]?.id ?? null
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    if (MAIN_MENU_ITEMS.some((item) => item.id === selectedId)) return;
    setSelectedId(MAIN_MENU_ITEMS[0]?.id ?? null);
  }, [selectedId, setSelectedId]);

  const handleQuit = async () => {
    const result = await shutdown();
    if (result.status === "closed") return;

    showToast({
      variant: result.status === "error" ? "error" : "warning",
      title: result.status === "error" ? "Quit Failed" : "Close Tab Manually",
      message: result.message,
    });
  };

  const handleActivate = (id: string) => {
    if (id === "quit") {
      void handleQuit();
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
  const { focusedValue } = useNavigation({
    containerRef: menuRef,
    role: "option",
    value: selectedId,
    onValueChange: setSelectedId,
    onEnter: handleActivate,
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
        menuRef={menuRef}
        selectedId={selectedId}
        focusedValue={focusedValue}
        onSelect={setSelectedId}
        onActivate={handleActivate}
        items={MAIN_MENU_ITEMS}
        isTrusted={isTrusted}
        hasLastReview={hasLastReview}
      />
    </div>
  );
}
