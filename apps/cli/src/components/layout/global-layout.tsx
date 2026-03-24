import { Box, useStdout } from "ink";
import type { ReactNode } from "react";
import { Header } from "./header.js";
import { Footer } from "./footer.js";
import { useNavigation } from "../../app/navigation-context.js";
import { useFooterContext } from "../../app/providers/footer-provider.js";

export interface GlobalLayoutProps {
  children: ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const { stdout } = useStdout();
  const { goBack, canGoBack } = useNavigation();
  const { shortcuts, rightShortcuts } = useFooterContext();

  return (
    <Box
      flexDirection="column"
      width={stdout.columns}
      height={stdout.rows}
    >
      <Header
        providerName="diffgazer"
        providerStatus="idle"
        onBack={canGoBack ? goBack : undefined}
      />
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>
      <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />
    </Box>
  );
}
