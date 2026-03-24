import { Box, useStdout } from "ink";
import type { ReactNode } from "react";
import { Header } from "./header.js";
import { Footer } from "./footer.js";
import { useNavigation } from "../../app/navigation-context.js";
import { useFooterContext } from "../../app/providers/footer-provider.js";
import { useInit } from "../../hooks/use-init.js";

function getProviderStatus(
  isLoading: boolean,
  isConfigured: boolean,
): "active" | "idle" {
  if (isLoading) return "idle";
  return isConfigured ? "active" : "idle";
}

function getProviderDisplay(provider?: string, model?: string): string {
  if (!provider) return "Not configured";
  if (model) return `${provider} / ${model}`;
  return provider;
}

export interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const { stdout } = useStdout();
  const { goBack, canGoBack } = useNavigation();
  const { shortcuts, rightShortcuts } = useFooterContext();
  const { data, isLoading } = useInit();

  const providerStatus = getProviderStatus(isLoading, data?.configured ?? false);
  const providerName = getProviderDisplay(
    data?.config?.provider,
    data?.config?.model,
  );

  return (
    <Box
      flexDirection="column"
      width={stdout.columns}
      height={stdout.rows}
    >
      <Header
        providerName={providerName}
        providerStatus={providerStatus}
        onBack={canGoBack ? goBack : undefined}
      />
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>
      <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />
    </Box>
  );
}
