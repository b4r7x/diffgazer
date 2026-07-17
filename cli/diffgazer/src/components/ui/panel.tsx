import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useTheme } from "../../theme/provider";

interface PanelProps {
  children: ReactNode;
}

interface PanelHeaderProps {
  variant?: "default" | "terminal" | "subtle";
  children: string;
}

interface PanelContentProps {
  children: ReactNode;
}

function PanelRoot({ children }: PanelProps) {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" width="100%" borderStyle="round" borderColor={tokens.border}>
      {children}
    </Box>
  );
}

function PanelHeader({ variant = "default", children }: PanelHeaderProps) {
  const { tokens } = useTheme();

  const colorByVariant: Record<NonNullable<PanelHeaderProps["variant"]>, string | undefined> = {
    terminal: tokens.accent,
    subtle: tokens.muted,
    default: undefined,
  };

  return (
    <Box>
      <Text bold color={colorByVariant[variant]}>
        {children}
      </Text>
    </Box>
  );
}

function PanelContent({ children }: PanelContentProps) {
  return <Box padding={1}>{children}</Box>;
}

export const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Content: PanelContent,
});
