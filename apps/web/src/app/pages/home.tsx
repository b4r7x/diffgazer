import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useScope, useKey } from "@/hooks/keyboard";
import { useRouteState } from "@/hooks/use-route-state";
import { usePageFooter } from "@/hooks/use-page-footer";
import { ContextSidebar, HomeMenu, type ContextInfo } from "@/features/home/components";
import { api } from "@/lib/api";

const MENU_ROUTES: Record<string, string> = {
  "review-unstaged": "/review",
  "review-staged": "/review?staged=true",
  "review-files": "/review?files=true",
  resume: "/review",
  history: "/history",
  settings: "/settings",
};

const FOOTER_SHORTCUTS = [
  { key: "up/dn", label: "Select" },
  { key: "Enter", label: "Open" },
  { key: "s", label: "Settings" },
  { key: "h", label: "Help" },
  { key: "q", label: "Quit" },
];

const DEMO_CONTEXT: ContextInfo = {
  trustedDir: "~/dev/stargazer-core",
  providerName: "Gemini",
  providerMode: "Balanced",
  lastRunId: "8821",
  lastRunIssueCount: 20,
};

interface HomePageProps {
  context?: ContextInfo;
}

export function HomePage({ context = DEMO_CONTEXT }: HomePageProps) {
  const [selectedIndex, setSelectedIndex] = useRouteState('menuIndex', 0);
  const navigate = useNavigate();

  const footerShortcuts = useMemo(() => FOOTER_SHORTCUTS, []);
  usePageFooter({ shortcuts: footerShortcuts });

  const handleActivate = (id: string) => {
    if (id === "quit") {
      handleQuit();
      return;
    }
    const route = MENU_ROUTES[id];
    if (route) {
      navigate({ to: route });
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
      <ContextSidebar context={context} />
      <HomeMenu
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onActivate={handleActivate}
      />
    </div>
  );
}
