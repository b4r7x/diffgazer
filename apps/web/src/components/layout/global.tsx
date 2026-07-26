import { useServerStatus } from "@diffgazer/core/api/hooks";
import { useFooterData } from "@diffgazer/core/footer";
import { getProviderDisplay, getProviderDisplayStatus } from "@diffgazer/core/providers";
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
 * Home is the cover screen and the only brand moment; every other route —
 * including the setup wizard — keeps the one-line header, so the wizard's one
 * signature is the reticle around the step rather than a second masthead.
 */
function isBrandScreen(pathname: string): boolean {
  return pathname === "/";
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
  const { loadState, provider, model, isConfigured } = useConfigData();

  const providerStatus = getProviderDisplayStatus(loadState.status !== "ready", isConfigured);
  let providerName = getProviderDisplay(provider, model);
  if (loadState.status === "loading") providerName = "Loading configuration";
  if (loadState.status === "error") providerName = "Configuration unavailable";
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
      wordmark={isBrandScreen(pathname) ? "banner" : "line"}
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
