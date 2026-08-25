import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement, ReactNode } from "react";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions";
import { useTheme } from "../../theme/provider";
import { Panel } from "../ui/panel";
import { Footer } from "./footer";
import { WORDMARK, WORDMARK_RULE } from "./header";

const PANEL_MAX_COLUMNS = 64;
const PANEL_MARGIN_COLUMNS = 4;
/** The Callout glyphs, so gate panels and inline callouts agree. */
const VARIANT_ICONS = { error: "✖", warning: "⚠" } as const;

interface GateShellProps {
  shortcuts?: Shortcut[];
  rightShortcuts?: Shortcut[];
  children: ReactNode;
}

/**
 * Frame for the pre-app gate states (server health, configuration): the same
 * wordmark block the in-app header draws, the gate content centered in the
 * remaining rows, and the footer hint bar pinned to the bottom row so gate
 * transitions never shift the chrome.
 */
export function GateShell({
  shortcuts = [],
  rightShortcuts = [],
  children,
}: GateShellProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexDirection="column" alignItems="center" paddingTop={1}>
        <Text color={tokens.accent} bold>
          {WORDMARK}
        </Text>
        <Text color={tokens.muted}>{WORDMARK_RULE}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        {children}
      </Box>
      <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />
    </Box>
  );
}

interface ErrorGatePanelProps {
  title: string;
  message: string;
  /** Identity of the thing that failed — e.g. the configuration's provider and model. */
  meta?: string;
  variant?: "error" | "warning";
  /** Action row, e.g. the focused Retry button. */
  children?: ReactNode;
}

/** Bounded hairline panel for a gate failure: variant-hued title, muted detail. */
export function ErrorGatePanel({
  title,
  message,
  meta,
  variant = "error",
  children,
}: ErrorGatePanelProps): ReactElement {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();

  return (
    <Box width={Math.min(columns - PANEL_MARGIN_COLUMNS, PANEL_MAX_COLUMNS)}>
      <Panel>
        <Panel.Content>
          <Box flexDirection="column" gap={1}>
            <Text color={tokens[variant]} bold>
              {VARIANT_ICONS[variant]} {title}
            </Text>
            {meta ? (
              <>
                <Text color={tokens.fg}>{meta}</Text>
                {/* The interrupted-rule stitch the web FailureView draws under its meta line. */}
                <Text color={tokens.muted} dimColor>
                  ── ──
                </Text>
              </>
            ) : null}
            <Text color={tokens.muted}>{message}</Text>
            {children}
          </Box>
        </Panel.Content>
      </Panel>
    </Box>
  );
}
