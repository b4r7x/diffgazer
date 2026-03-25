import { Box } from "ink";
import type { ReactNode } from "react";
import { Header } from "./header.js";
import { Footer } from "./footer.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";
import { useNavigation } from "../../app/navigation-context.js";
import { useFooterContext } from "../../app/providers/footer-provider.js";
import { useInit } from "@diffgazer/api/hooks";
import { getProviderStatus, getProviderDisplay } from "@diffgazer/core/format";

export interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const { columns, rows } = useTerminalDimensions();
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
      width={columns}
      height={rows}
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
