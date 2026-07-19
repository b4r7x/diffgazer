import { useFooterData } from "@diffgazer/core/footer";
import { getProviderDisplay, getProviderDisplayStatus } from "@diffgazer/core/providers";
import { useKey, useKeyboardContext } from "@diffgazer/keys";
import { toast } from "@diffgazer/ui/components/toast";
import { useCanGoBack, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { shutdown } from "@/features/home/lib/shutdown";
import { useConfigData } from "@/hooks/use-config";
import { resolveBackAction } from "@/lib/back-navigation";
import { getMainContent, MAIN_CONTENT_ID } from "@/lib/main-content";
import { Footer } from "./footer";
import { Header } from "./header";

function ConnectedHeader() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const { loadState, provider, model, isConfigured } = useConfigData();

  const providerStatus = getProviderDisplayStatus(loadState.status !== "ready", isConfigured);
  let providerName = getProviderDisplay(provider, model);
  if (loadState.status === "loading") providerName = "Loading configuration";
  if (loadState.status === "error") providerName = "Configuration unavailable";
  const backAction = resolveBackAction(pathname, canGoBack);

  const onBack = () => {
    if (backAction.type === "navigate") {
      void router.navigate({ to: backAction.to });
      return;
    }

    if (backAction.type === "history") {
      router.history.back();
    }
  };

  const isDenseWorkScreen = pathname.startsWith("/review") || pathname.startsWith("/history");

  return (
    <Header
      providerName={providerName}
      providerStatus={providerStatus}
      onBack={backAction.type === "none" ? undefined : onBack}
      wordmark={isDenseWorkScreen ? "compact" : "full"}
    />
  );
}

function ConnectedFooter() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function isDialogScope(scope: string | null): boolean {
  return scope === "dialog" || scope?.endsWith("-dialog") === true;
}

function hasOpenDialog(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { activeScope } = useKeyboardContext();
  const enabled = pathname !== "/onboarding" && !isDialogScope(activeScope);
  const shortcutScope = enabled ? activeScope : null;

  const navigateUnlessCurrent = (to: "/settings" | "/history" | "/help") => {
    if (pathname !== to) void navigate({ to });
  };

  const handleQuit = () => {
    if (hasOpenDialog()) return;
    void shutdown().then((result) => {
      if (result.status === "closed") return;
      const variant = result.status === "error" ? "error" : "warning";
      const title = result.status === "error" ? "Quit Failed" : "Close Tab Manually";
      toast[variant](title, { message: result.message });
    });
  };
  const openSettings = () => {
    if (!hasOpenDialog()) navigateUnlessCurrent("/settings");
  };
  const openHistory = () => {
    if (!hasOpenDialog()) navigateUnlessCurrent("/history");
  };
  const openHelp = () => {
    if (!hasOpenDialog()) navigateUnlessCurrent("/help");
  };

  useKey("q", handleQuit, { scope: shortcutScope });
  useKey("s", openSettings, { scope: shortcutScope });
  useKey("h", openHistory, { scope: shortcutScope });
  useKey("shift+?", openHelp, { scope: shortcutScope });

  return null;
}

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] selection:bg-info selection:text-info-foreground">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={() => getMainContent()?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:p-2 focus:bg-background focus:text-foreground focus:border focus:border-border"
      >
        Skip to main content
      </a>
      <ConnectedHeader />
      <GlobalShortcuts />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <ConnectedFooter />
    </div>
  );
}
