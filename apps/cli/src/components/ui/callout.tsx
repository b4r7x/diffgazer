import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type CalloutVariant = "info" | "warning" | "error" | "success";

interface CalloutProps {
  children: ReactNode;
  variant?: CalloutVariant;
  title?: string;
}

const VARIANT_ICONS: Record<CalloutVariant, string> = {
  info: "ℹ",
  warning: "⚠",
  error: "✗",
  success: "✓",
};

export function Callout({
  children,
  variant = "info",
  title,
}: CalloutProps): ReactElement {
  const { colors } = useTheme();

  const variantColors: Record<CalloutVariant, string> = {
    info: colors.ui.info,
    warning: colors.ui.warning,
    error: colors.ui.error,
    success: colors.ui.success,
  };

  const color = variantColors[variant];
  const icon = VARIANT_ICONS[variant];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      paddingY={1}
      width="100%"
    >
      <Box>
        <Text color={color} bold>
          {icon}
        </Text>
        {title && (
          <>
            <Text> </Text>
            <Text color={color} bold>
              {title}
            </Text>
          </>
        )}
      </Box>
      <Box marginTop={title ? 1 : 0} marginLeft={2}>
        <Text color={colors.ui.text}>{children}</Text>
      </Box>
    </Box>
  );
}
