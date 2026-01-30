import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface PanelProps {
  children: ReactNode;
  borderless?: boolean;
  borderColor?: string;
  width?: number | string;
}

export interface PanelHeaderProps {
  children: ReactNode;
  variant?: "default" | "subtle" | "floating" | "badge" | "section";
  value?: ReactNode;
  valueVariant?: "default" | "success" | "muted";
}

export interface PanelContentProps {
  children: ReactNode;
  spacing?: "none" | "sm" | "md";
}

export interface PanelDividerProps {
  width?: number;
}

export function Panel({
  children,
  borderless,
  borderColor,
  width,
}: PanelProps): ReactElement {
  const { colors } = useTheme();
  const resolvedBorderColor = borderColor ?? colors.ui.border;

  if (borderless) {
    return (
      <Box flexDirection="column" width={width}>
        {children}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={resolvedBorderColor}
      width={width}
    >
      {children}
    </Box>
  );
}

export function PanelHeader({
  children,
  variant = "default",
  value,
  valueVariant = "default",
}: PanelHeaderProps): ReactElement {
  const { colors } = useTheme();

  const getValueColor = (): string => {
    switch (valueVariant) {
      case "success":
        return colors.ui.success;
      case "muted":
        return colors.ui.textMuted;
      default:
        return colors.ui.text;
    }
  };

  const renderValue = (): ReactElement | null => {
    if (value === undefined) return null;
    return <Text color={getValueColor()}>{value}</Text>;
  };

  switch (variant) {
    case "subtle":
      return (
        <Box
          paddingX={1}
          paddingY={0}
          justifyContent="space-between"
          borderBottom
          borderColor={colors.ui.border}
        >
          <Text color={colors.ui.textMuted} dimColor>
            {children}
          </Text>
          {renderValue()}
        </Box>
      );

    case "floating":
      return (
        <Box marginBottom={1}>
          <Text color={colors.ui.accent} bold>
            {children}
          </Text>
          {value !== undefined && (
            <Box marginLeft={1}>{renderValue()}</Box>
          )}
        </Box>
      );

    case "badge":
      return (
        <Box marginBottom={1}>
          <Text bold color={colors.ui.accent}>
            [{children}]
          </Text>
          {value !== undefined && (
            <Box marginLeft={1}>{renderValue()}</Box>
          )}
        </Box>
      );

    case "section":
      return (
        <Box marginBottom={1} justifyContent="space-between">
          <Text color={colors.ui.textMuted} bold>
            ── {children} ──
          </Text>
          {renderValue()}
        </Box>
      );

    default:
      return (
        <Box
          paddingX={1}
          justifyContent="space-between"
          borderBottom
          borderColor={colors.ui.border}
        >
          <Text bold color={colors.ui.textMuted}>
            {children}
          </Text>
          {renderValue()}
        </Box>
      );
  }
}

export function PanelContent({
  children,
  spacing = "md",
}: PanelContentProps): ReactElement {
  const paddingY = spacing === "none" ? 0 : spacing === "sm" ? 0 : 1;
  const gap = spacing === "none" ? 0 : spacing === "sm" ? 1 : 1;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={paddingY} gap={gap}>
      {children}
    </Box>
  );
}

export function PanelDivider({ width }: PanelDividerProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box paddingX={1}>
      <Text color={colors.ui.border} dimColor>
        {width ? "─".repeat(width) : "────────────────────────────────"}
      </Text>
    </Box>
  );
}
