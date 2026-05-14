import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { Header } from "./header.js";
import { Footer } from "./footer.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";
import { useNavigation } from "../../app/navigation-context.js";
import { useFooterData } from "@diffgazer/core/footer";
import { useInit } from "@diffgazer/core/api/hooks";
import { getProviderDisplayStatus, getProviderDisplay } from "@diffgazer/core/providers";

const MIN_COLUMNS = 40;

function ConnectedHeader() {
  const { goBack, canGoBack } = useNavigation();
  const { data, isLoading } = useInit();

  const providerStatus = getProviderDisplayStatus(isLoading, data?.configured ?? false);
  const providerName = getProviderDisplay(data?.config?.provider, data?.config?.model);

  return (
    <Header
      providerName={providerName}
      providerStatus={providerStatus}
      onBack={canGoBack ? goBack : undefined}
    />
  );
}

function ConnectedFooter() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

export interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const { columns, rows } = useTerminalDimensions();

  if (columns < MIN_COLUMNS) {
    return (
      <Box width={columns} height={rows} justifyContent="center" alignItems="center">
        <Text>Terminal too small ({columns} cols). Minimum: {MIN_COLUMNS}.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <ConnectedHeader />
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>
      <ConnectedFooter />
    </Box>
  );
}
