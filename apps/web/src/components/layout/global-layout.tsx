import { type ReactNode } from "react";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { Header } from "./header";
import { Footer } from "./footer";
import { useFooterData } from "@diffgazer/core/footer";
import { useConfigData } from "@/app/providers/config-provider";
import { resolveBackAction } from "@/lib/back-navigation";
import { getProviderDisplayStatus, getProviderDisplay } from "@diffgazer/core/providers";

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
      <ConnectedHeader />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      <ConnectedFooter />
    </div>
  );
}
