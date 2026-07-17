import { useFooterData } from "@diffgazer/core/footer";
import { getProviderDisplay, getProviderDisplayStatus } from "@diffgazer/core/providers";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
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

interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden selection:bg-info selection:text-info-foreground">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={() => getMainContent()?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:p-2 focus:bg-background focus:text-foreground focus:border focus:border-border"
      >
        Skip to main content
      </a>
      <ConnectedHeader />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <ConnectedFooter />
    </div>
  );
}
