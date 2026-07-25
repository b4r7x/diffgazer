import { useInit } from "@diffgazer/core/api/hooks";
import { useFooterData } from "@diffgazer/core/footer";
import { getProviderDisplay, getProviderDisplayStatus } from "@diffgazer/core/providers";
import { Box } from "ink";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useNavigation } from "../../hooks/use-navigation";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions";
import { Footer } from "./footer";
import { Header } from "./header";
import { isTerminalTooSmall, TerminalTooSmall } from "./terminal-too-small";

const HEADER_ROWS = 3;
const FOOTER_ROWS = 1;

export function getContentZoneRows(rows: number): number {
  return Math.max(rows - HEADER_ROWS - FOOTER_ROWS, 0);
}

export interface ContentZone {
  columns: number;
  rows: number;
  contentRows: number;
  contentColumns: number;
}

const ContentZoneContext = createContext<ContentZone | null>(null);

export function useContentZone(): ContentZone {
  const contentZone = useContext(ContentZoneContext);
  if (!contentZone) {
    throw new Error("useContentZone must be used within GlobalLayout");
  }
  return contentZone;
}

function ConnectedHeader() {
  const { canGoBack } = useNavigation();
  const { data, isLoading } = useInit();

  const providerStatus = getProviderDisplayStatus(isLoading, data?.configured ?? false);
  const providerName = getProviderDisplay(data?.config?.provider, data?.config?.model);

  return (
    <Header providerName={providerName} providerStatus={providerStatus} showBack={canGoBack} />
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

  if (isTerminalTooSmall(columns, rows)) {
    return <TerminalTooSmall columns={columns} rows={rows} />;
  }

  const contentZone = {
    columns,
    rows,
    contentRows: getContentZoneRows(rows),
    contentColumns: columns,
  };

  return (
    <ContentZoneContext value={contentZone}>
      <Box flexDirection="column" width={columns} height={rows}>
        <ConnectedHeader />
        <Box flexGrow={1} minHeight={0} overflow="hidden" flexDirection="column">
          {children}
        </Box>
        <ConnectedFooter />
      </Box>
    </ContentZoneContext>
  );
}
