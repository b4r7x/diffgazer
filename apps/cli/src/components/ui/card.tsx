import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

interface CardProps {
  title?: string;
  titleColor?: string;
  children: ReactNode;
  borderColor?: string;
  padding?: number;
  width?: number | string;
}

export function Card({
  title,
  titleColor,
  children,
  borderColor,
  padding = 1,
  width,
}: CardProps): ReactElement {
  const { colors } = useTheme();

  const resolvedBorderColor = borderColor ?? colors.ui.border;
  const resolvedTitleColor = titleColor ?? colors.ui.accent;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={resolvedBorderColor}
      paddingX={padding}
      paddingY={padding > 0 ? 1 : 0}
      width={width}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold color={resolvedTitleColor}>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}
