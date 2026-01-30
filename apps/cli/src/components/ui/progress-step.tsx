import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useTheme } from "../../hooks/use-theme.js";

export type ProgressStatus = "completed" | "active" | "pending";

export interface ProgressStepProps {
  label: string;
  status: ProgressStatus;
  children?: ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const STATUS_INDICATORS: Record<ProgressStatus, string> = {
  completed: "\u2713",
  active: "\u25CF",
  pending: " ",
};

export function ProgressStep({
  label,
  status,
  children,
  isExpanded = false,
}: ProgressStepProps): ReactElement {
  const { colors } = useTheme();
  const hasChildren = Boolean(children);

  const statusColors: Record<ProgressStatus, string> = {
    completed: colors.ui.success,
    active: colors.ui.info,
    pending: colors.ui.textMuted,
  };

  const labelColors: Record<ProgressStatus, string> = {
    completed: colors.ui.text,
    active: colors.ui.info,
    pending: colors.ui.textMuted,
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={statusColors[status]}>
          [
          {status === "active" ? (
            <Spinner type="dots" />
          ) : (
            STATUS_INDICATORS[status]
          )}
          ]
        </Text>
        <Text> </Text>
        <Text color={labelColors[status]} bold={status === "active"}>
          {label}
        </Text>
      </Box>
      {hasChildren && isExpanded && (
        <Box marginLeft={4} marginTop={1}>
          {children}
        </Box>
      )}
    </Box>
  );
}
