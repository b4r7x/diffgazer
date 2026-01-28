import { type ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { useFooter } from "./footer-context";
import { ToastContainer } from "./toast-container";
import { useConfig } from "@/features/settings/hooks/use-config";

interface GlobalLayoutProps {
  children: ReactNode;
}

function getProviderStatus(isLoading: boolean, isConfigured: boolean) {
  if (isLoading) return "idle" as const;
  return isConfigured ? "active" as const : "idle" as const;
}

function getProviderDisplay(provider?: string, model?: string) {
  if (!provider) return "Not configured";
  if (model) return `${provider} / ${model}`;
  return provider;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const { provider, model, isConfigured, isLoading } = useConfig();
  const { shortcuts, rightShortcuts } = useFooter();

  const providerStatus = getProviderStatus(isLoading, isConfigured);
  const providerName = getProviderDisplay(provider, model);

  return (
    <div className="tui-base h-screen flex flex-col overflow-hidden selection:bg-tui-blue selection:text-black">
      <Header providerName={providerName} providerStatus={providerStatus} />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />
      <ToastContainer />
    </div>
  );
}
