import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { paneBorder } from "../../theme/chrome";
import { useTheme } from "../../theme/provider";

interface PanelProps {
  /** Draws the reticle: heavy corners in the focus hue while the pane holds focus. */
  focused?: boolean;
  /** Lets the panel stretch to fill the row it sits in. */
  grow?: boolean;
  children: ReactNode;
}

interface PanelHeaderProps {
  variant?: "default" | "terminal" | "subtle";
  children: string;
}

interface PanelContentProps {
  grow?: boolean;
  children: ReactNode;
}

function PanelRoot({ focused = false, grow = false, children }: PanelProps) {
  const { tokens } = useTheme();

  return (
    <Box
      flexDirection="column"
      width="100%"
      flexGrow={grow ? 1 : 0}
      {...paneBorder(tokens, focused)}
    >
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
    <Box paddingX={1}>
      <Text bold color={colorByVariant[variant]}>
        {children}
      </Text>
    </Box>
  );
}

function PanelContent({ grow = false, children }: PanelContentProps) {
  return (
    <Box padding={1} flexGrow={grow ? 1 : 0}>
      {children}
    </Box>
  );
}

export const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Content: PanelContent,
});
