import type { ReactElement, ReactNode } from "react";
import { Box, useStdout } from "ink";

const DEFAULT_BREAKPOINT = 90;

interface SplitPaneProps {
  leftWidth?: number;
  rightWidth?: number;
  gap?: number;
  height?: number;
  breakpoint?: number;
  children: [ReactNode, ReactNode];
}

export function SplitPane({
  leftWidth,
  rightWidth,
  gap = 1,
  height,
  breakpoint = DEFAULT_BREAKPOINT,
  children,
}: SplitPaneProps): ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const isNarrow = terminalWidth < breakpoint;

  const [left, right] = children;

  if (isNarrow) {
    return (
      <Box flexDirection="column" gap={gap} height={height}>
        <Box flexDirection="column" flexGrow={1}>
          {left}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {right}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" gap={gap} height={height}>
      <Box
        flexDirection="column"
        width={leftWidth}
        flexGrow={leftWidth === undefined ? 1 : undefined}
        flexShrink={0}
      >
        {left}
      </Box>
      <Box
        flexDirection="column"
        width={rightWidth}
        flexGrow={rightWidth === undefined ? 2 : undefined}
        flexShrink={0}
      >
        {right}
      </Box>
    </Box>
  );
}
