import type { ReactNode } from "react";
import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { Header } from "./header";
import { Footer, useFooterData } from "./footer";
import { ToastContainer } from "@/components/ui/toast";
import { useConfigData, useConfigActions } from "@/app/providers/config-provider";

interface GlobalLayoutProps {
  children: ReactNode;
}

function getProviderStatus(isLoading: boolean, isConfigured: boolean): "active" | "idle" {
  if (isLoading) return "idle";
  return isConfigured ? "active" : "idle";
}

function getProviderDisplay(provider?: string, model?: string): string {
  if (!provider) return "Not configured";
  if (model) return `${provider} / ${model}`;
  return provider;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { provider, model, isConfigured } = useConfigData();
  const { isLoading } = useConfigActions();
  const { shortcuts, rightShortcuts } = useFooterData();

  const providerStatus = getProviderStatus(isLoading, isConfigured);
  const providerName = getProviderDisplay(provider, model);
  const showBack = canGoBack && router.state.location.pathname !== "/";

  return (
    <div className="tui-base h-screen flex flex-col overflow-hidden selection:bg-tui-blue selection:text-black">
      <Header
        providerName={providerName}
        providerStatus={providerStatus}
        onBack={showBack ? () => router.history.back() : undefined}
      />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />
      <ToastContainer />
    </div>
  );
}
