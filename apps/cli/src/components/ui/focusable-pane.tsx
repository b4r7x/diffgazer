import type { ReactElement, ReactNode } from "react";
import { Box } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface FocusablePaneProps {
  isFocused?: boolean;
  children: ReactNode;
  width?: number | string;
  height?: number | string;
}

export function FocusablePane({
  isFocused,
  children,
  width,
  height,
}: FocusablePaneProps): ReactElement {
  const { colors } = useTheme();

  const borderColor = isFocused ? colors.ui.borderFocused : colors.ui.border;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      width={width}
      height={height}
    >
      {children}
    </Box>
  );
}
