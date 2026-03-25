import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";

interface PanelProps {
  variant?: "default" | "borderless";
  children: ReactNode;
}

interface PanelHeaderProps {
  variant?: "default" | "terminal" | "subtle";
  children: string;
}

interface PanelContentProps {
  children: ReactNode;
}

interface PanelFooterProps {
  children: string;
}

function PanelRoot({ variant = "default", children }: PanelProps) {
  const { tokens } = useTheme();

  if (variant === "borderless") {
    return (
      <Box flexDirection="column" width="100%">
        {children}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      width="100%"
      borderStyle="round"
      borderColor={tokens.border}
    >
      {children}
    </Box>
  );
}

function PanelHeader({ variant = "default", children }: PanelHeaderProps) {
  const { tokens } = useTheme();

  const color =
    variant === "terminal"
      ? tokens.accent
      : variant === "subtle"
        ? tokens.muted
        : undefined;

  return (
    <Box>
      <Text bold color={color}>
        {children}
      </Text>
    </Box>
  );
}

function PanelContent({ children }: PanelContentProps) {
  return <Box padding={1}>{children}</Box>;
}

function PanelFooter({ children }: PanelFooterProps) {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();

  return (
    <Box flexDirection="column">
      <Text color={tokens.muted}>{"─".repeat(columns)}</Text>
      <Box>
        <Text color={tokens.muted}>{children}</Text>
      </Box>
    </Box>
  );
}

export const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Content: PanelContent,
  Footer: PanelFooter,
});
