import { Box } from "ink";
import type { ReactElement, ReactNode } from "react";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";
import { HeaderBrand } from "../ui/header-brand.js";
import { FooterBar } from "../ui/footer-bar.js";
import type { Shortcut } from "@repo/schemas/ui";

interface GlobalLayoutProps {
  children: ReactNode;
  shortcuts?: Shortcut[];
  showHeader?: boolean;
}

export function GlobalLayout({
  children,
  shortcuts = [],
  showHeader = true
}: GlobalLayoutProps): ReactElement {
  const { columns, rows } = useTerminalDimensions();

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
    >
      {/* Header - fixed at top with padding */}
      {showHeader && (
        <Box flexDirection="column" alignItems="center" width="100%" paddingTop={1}>
          <HeaderBrand />
        </Box>
      )}

      {/* Content - grows to fill space */}
      <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        {children}
      </Box>

      {/* Footer - fixed at bottom */}
      <Box width="100%">
        <FooterBar shortcuts={shortcuts} />
      </Box>
    </Box>
  );
}
