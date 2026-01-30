import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

interface CardProps {
  title?: string;
  titleColor?: string;
  badge?: ReactNode;
  children: ReactNode;
  borderColor?: string;
  padding?: number;
  width?: number | string;
}

export function Card({
  title,
  titleColor,
  badge,
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
        <Box marginBottom={1} gap={1}>
          <Text bold color={resolvedTitleColor}>
            {title}
          </Text>
          {badge}
        </Box>
      )}
      {children}
    </Box>
  );
}

interface CardSectionProps {
  title?: string;
  children: ReactNode;
}

export function CardSection({ title, children }: CardSectionProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column" marginTop={title ? 1 : 0}>
      {title && (
        <Box marginBottom={1}>
          <Text color={colors.ui.textMuted} dimColor>
            ── {title} ──
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}
