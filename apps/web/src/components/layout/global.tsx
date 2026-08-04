import { useServerStatus } from "@diffgazer/core/api/hooks";
import { useFooterData } from "@diffgazer/core/footer";
import {
  getProviderDisplay,
  getProviderDisplayStatus,
  getUnconfiguredDisplayStatus,
  PRODUCT_REGISTRY,
} from "@diffgazer/core/providers";
import { useKey, useKeyboardContext } from "@diffgazer/keys";
import { useCanGoBack, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useConfigData } from "@/hooks/use-config";
import { performBackAction, resolveBackAction } from "@/lib/back-navigation";
import { getMainContent, MAIN_CONTENT_ID } from "@/lib/main-content";
import { reportShutdownResult, shutdown } from "@/lib/shutdown";
import { ConnectionStrip } from "./connection-strip";
import { Footer } from "./footer";
import { Header, type HeaderServerState } from "./header";

/**
 * Screens that open a section — home, help, the setup wizard — carry the full
 * banner in the shell header, and the whole settings section keeps it so the
 * wordmark never resizes moving between the hub and its children. Everything
 * else is a dense working screen (history, review, 404), where the smaller
 * block keeps the header compact.
 */
const HERO_WORDMARK_ROUTES = new Set(["/", "/help", "/onboarding"]);

export function getWordmarkTier(pathname: string): "hero" | "dense" {
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "hero";
  return HERO_WORDMARK_ROUTES.has(pathname) ? "hero" : "dense";
}

/**
 * The shell's view of the transport. `latestState` is the state of the last
 * health poll, so a failed refetch over cached data surfaces here while the
 * latched `state` keeps the tree mounted - the shell stays up and tells the
 * truth instead of unmounting into a blank page.
 */
function useTransportState(): { state: HeaderServerState; retry: () => void } {
  const { latestState, retry } = useServerStatus();
  const [hasFailed, setHasFailed] = useState(false);

  if (latestState.status === "error" && !hasFailed) setHasFailed(true);
  if (latestState.status === "connected" && hasFailed) setHasFailed(false);

  let state: HeaderServerState = "live";
  if (latestState.status === "error") state = "offline";
  else if (latestState.status === "checking" && hasFailed) state = "retrying";

  return {
    state,
    retry: () => {
      void retry().catch(() => {});
    },
  };
}

function ConnectedHeader({ serverState }: { serverState: HeaderServerState }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const { loadState, selectedConfiguration, selectedReadiness } = useConfigData();

  let providerStatus = getUnconfiguredDisplayStatus();
  let providerName = "Not configured";

  if (loadState.status === "loading") {
    providerName = "Loading configuration";
    providerStatus = getUnconfiguredDisplayStatus({ label: "Loading", shortLabel: "loading" });
  } else if (loadState.status === "error") {
    providerName = "Configuration unavailable";
    providerStatus = getUnconfiguredDisplayStatus({
      label: "Unavailable",
      shortLabel: "unavailable",
    });
  } else if (selectedConfiguration && selectedReadiness) {
    providerStatus = getProviderDisplayStatus(
      selectedReadiness,
      selectedConfiguration.transportFamily,
    );
    providerName =
      selectedConfiguration.status === "supported"
        ? getProviderDisplay(
            PRODUCT_REGISTRY[selectedConfiguration.productId].presentation.name,
            selectedConfiguration.selectedModelId ?? undefined,
          )
        : PRODUCT_REGISTRY[selectedConfiguration.productId].presentation.name;
  }
  const backAction = resolveBackAction(pathname, canGoBack);

  const onBack = () => {
    performBackAction(router, backAction);
  };

  return (
    <Header
      providerName={providerName}
      providerStatus={providerStatus}
      serverState={serverState}
      onBack={backAction.type === "none" ? undefined : onBack}
      wordmark={getWordmarkTier(pathname)}
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

/**
 * Not every dialog registers a keys scope (the model-select dialog does not), so
 * the open `<dialog>` in the DOM is the second, authoritative check alongside
 * `isDialogScope`.
 */
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
    if (hasOpenDialog() || pathname === to) return;
    void navigate({ to });
  };

  const handleQuit = () => {
    if (hasOpenDialog()) return;
    void shutdown().then(reportShutdownResult);
  };

  useKey("q", handleQuit, { scope: shortcutScope });
  useKey("s", () => navigateUnlessCurrent("/settings"), { scope: shortcutScope });
  useKey("h", () => navigateUnlessCurrent("/history"), { scope: shortcutScope });
  useKey("shift+?", () => navigateUnlessCurrent("/help"), { scope: shortcutScope });

  return null;
}

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const transport = useTransportState();

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] selection:bg-info selection:text-info-foreground"
      data-layout="app-shell"
    >
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={() => getMainContent()?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:p-2 focus:bg-background focus:text-foreground focus:border focus:border-border"
      >
        Skip to main content
      </a>
      <ConnectedHeader serverState={transport.state} />
      {transport.state === "live" ? null : (
        <ConnectionStrip state={transport.state} onRetry={transport.retry} />
      )}
      <GlobalShortcuts />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <ConnectedFooter />
    </div>
  );
}
