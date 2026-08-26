import { useServerStatus } from "@diffgazer/core/api/hooks";
import { useFooterData } from "@diffgazer/core/footer";
import { resolveShellProviderIdentity, type ShellProviderState } from "@diffgazer/core/providers";
import type { ClientConfigurationSummary, Readiness } from "@diffgazer/core/schemas/config";
import { useKey, useKeyboardContext } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { toast } from "@diffgazer/ui/components/toast";
import { useCanGoBack, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useConfigData } from "@/hooks/use-config";
import { isDialogScope } from "@/hooks/use-dialog-scope";
import { usePointerFocusGuard } from "@/hooks/use-pointer-focus-guard";
import { performBackAction, resolveBackAction } from "@/lib/back-navigation";
import { getMainContent, MAIN_CONTENT_ID } from "@/lib/main-content";
import { reportShutdownResult, shutdown } from "@/lib/shutdown";
import { Footer } from "./footer";
import { Header, type HeaderServerState } from "./header";
import { HeaderChromeProvider, useHeaderBackButtonRef } from "./header-chrome";
import { StreamingReviewProvider, useStreamingReviewCancelRef } from "./streaming-review";

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

const CONNECTION_TOAST_ID = "server-connection";

/**
 * A lost connection surfaces as one persistent error toast with a Retry
 * action; the header chip carries the Reconnecting word while a retry is in
 * flight. Reconnecting dismisses the outage toast and confirms briefly. The
 * toast store is an external system, so a transition effect is the right tool.
 */
function useConnectionToast(state: HeaderServerState, retry: () => void) {
  const wasOffline = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retry delegates to React Query's stable refetch, so the closure never goes stale; the per-render wrapper identity would re-issue the offline toast every render if listed.
  useEffect(() => {
    if (state === "offline") {
      wasOffline.current = true;
      toast.error("Server not responding — reviews and history are frozen.", {
        id: CONNECTION_TOAST_ID,
        action: (
          <Button variant="secondary" size="sm" bracket onClick={retry}>
            Retry
          </Button>
        ),
      });
      return;
    }
    if (state === "live" && wasOffline.current) {
      wasOffline.current = false;
      toast.dismiss(CONNECTION_TOAST_ID);
      toast.success("Reconnected", { duration: 2500 });
    }
  }, [state]);
}

function toShellProviderState(config: {
  loadState: { status: "loading" | "error" | "ready" };
  selectedConfiguration: ClientConfigurationSummary | null;
  selectedReadiness: Readiness | null;
}): ShellProviderState {
  const { loadState, selectedConfiguration, selectedReadiness } = config;
  if (loadState.status === "loading") return { status: "loading" };
  if (loadState.status === "error") return { status: "error" };
  if (!selectedConfiguration || !selectedReadiness) return { status: "unconfigured" };

  return {
    status: "configured",
    readiness: selectedReadiness,
    productId: selectedConfiguration.productId,
    modelId: selectedConfiguration.selectedModelId,
  };
}

function ConnectedHeader({ serverState }: { serverState: HeaderServerState }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const config = useConfigData();
  const backButtonRef = useHeaderBackButtonRef();

  const { providerName, providerStatus } = resolveShellProviderIdentity(
    toShellProviderState(config),
  );
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
      backButtonRef={backButtonRef}
      wordmark={getWordmarkTier(pathname)}
    />
  );
}

function ConnectedFooter() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { activeScope } = useKeyboardContext();
  const streamingReviewCancel = useStreamingReviewCancelRef();
  // Every dialog in the app registers its scope through use-dialog-scope while
  // it is open, and a null scope registers no keys at all. Only open dialogs
  // suppress quit — it stays live on onboarding, as in the TUI — while the
  // section jumps also wait until setup completes.
  const dialogOpen = isDialogScope(activeScope);
  const quitScope = dialogOpen ? null : activeScope;
  const sectionScope = dialogOpen || pathname === "/onboarding" ? null : activeScope;

  const navigateUnlessCurrent = (to: "/settings" | "/history" | "/help") => {
    if (pathname === to) return;
    void navigate({ to });
  };

  // A streaming review owns q: cancel the run and keep the app alive, matching
  // the TUI's quit interception while a review streams.
  const handleQuit = () => {
    const cancelRun = streamingReviewCancel.current;
    if (cancelRun) {
      cancelRun();
      return;
    }
    void shutdown().then(reportShutdownResult);
  };

  useKey("q", handleQuit, { scope: quitScope });
  useKey("s", () => navigateUnlessCurrent("/settings"), { scope: sectionScope });
  useKey("h", () => navigateUnlessCurrent("/history"), { scope: sectionScope });
  useKey("shift+?", () => navigateUnlessCurrent("/help"), { scope: sectionScope });

  return null;
}

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const transport = useTransportState();
  const mainRef = useRef<HTMLElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const streamingReviewCancel = useRef<(() => void) | null>(null);

  usePointerFocusGuard(mainRef);
  useConnectionToast(transport.state, transport.retry);

  return (
    <HeaderChromeProvider value={backButtonRef}>
      <StreamingReviewProvider value={streamingReviewCancel}>
        <div
          className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] selection:bg-info selection:text-info-foreground"
          data-layout="app-shell"
        >
          {/* focus: dialect, not the shared focus-visible grammar: the sr-only reveal
            must trigger on any focus, so the outline rides the same condition. */}
          <a
            href={`#${MAIN_CONTENT_ID}`}
            onClick={() => getMainContent()?.focus()}
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:p-2 focus:bg-background focus:text-foreground focus:border focus:border-border focus:outline-2 focus:outline-ring focus:outline-offset-0"
          >
            Skip to main content
          </a>
          <ConnectedHeader serverState={transport.state} />
          <GlobalShortcuts />
          <main
            ref={mainRef}
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {children}
          </main>
          <ConnectedFooter />
        </div>
      </StreamingReviewProvider>
    </HeaderChromeProvider>
  );
}
