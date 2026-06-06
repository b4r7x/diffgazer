import { useFooterData } from "@diffgazer/core/footer";
import { getProviderDisplay, getProviderDisplayStatus } from "@diffgazer/core/providers";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useConfigData } from "@/app/providers/config";
import { resolveBackAction } from "@/lib/back-navigation";
import { Footer } from "./footer";
import { Header } from "./header";

function ConnectedHeader() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const { provider, model, isConfigured, isLoading } = useConfigData();

  const providerStatus = getProviderDisplayStatus(isLoading, isConfigured);
  const providerName = getProviderDisplay(provider, model);
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

  return (
    <Header
      providerName={providerName}
      providerStatus={providerStatus}
      onBack={backAction.type === "none" ? undefined : onBack}
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
    <div className="tui-base h-screen min-w-[768px] flex flex-col overflow-hidden selection:bg-tui-blue selection:text-black">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:p-2 focus:bg-background focus:text-foreground focus:border focus:border-border"
      >
        Skip to main content
      </a>
      <ConnectedHeader />
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">{children}</main>
      <ConnectedFooter />
    </div>
  );
}
