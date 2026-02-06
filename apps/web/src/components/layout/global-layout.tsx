import { type ReactNode } from "react";
import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { Header } from "./header";
import { Footer, useFooterData } from "./footer";
import { ToastContainer } from "@/components/ui/toast";
import { useConfigData, useConfigActions } from "@/app/providers/config-provider";

function getProviderStatus(isLoading: boolean, isConfigured: boolean): "active" | "idle" {
  if (isLoading) return "idle";
  return isConfigured ? "active" : "idle";
}

function getProviderDisplay(provider?: string, model?: string): string {
  if (!provider) return "Not configured";
  if (model) return `${provider} / ${model}`;
  return provider;
}

function ConnectedHeader() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { provider, model, isConfigured } = useConfigData();
  const { isLoading } = useConfigActions();

  const providerStatus = getProviderStatus(isLoading, isConfigured);
  const providerName = getProviderDisplay(provider, model);
  const showBack = canGoBack && router.state.location.pathname !== "/";

  const onBack = () => {
    router.history.back();
  };

  return (
    <Header
      providerName={providerName}
      providerStatus={providerStatus}
      onBack={showBack ? onBack : undefined}
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
    <div className="tui-base h-screen flex flex-col overflow-hidden selection:bg-tui-blue selection:text-black">
      <ConnectedHeader />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      <ConnectedFooter />
      <ToastContainer />
    </div>
  );
}
