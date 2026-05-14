import { Box, Text } from "ink";
import type {
  ProgressStatus,
  ProgressSubstepData,
} from "@diffgazer/core/schemas/ui";
import { Spinner } from "../../../components/ui/spinner.js";
import { Badge } from "../../../components/ui/badge.js";
import { useTheme } from "../../../theme/theme-context.js";

export interface ProgressStepProps {
  name: string;
  status: ProgressStatus;
  substeps?: ProgressSubstepData[];
  duration?: number;
}

const STEP_ICON: Record<ProgressStatus, string> = {
  active: "◐",
  completed: "●",
  pending: "○",
};

const SUBSTEP_BADGE_VARIANT = {
  pending: "neutral",
  active: "info",
  completed: "success",
  error: "error",
} as const;

export function ProgressStep({
  name,
  status,
  substeps,
  duration,
}: ProgressStepProps) {
  const { tokens } = useTheme();

  const stepColor =
    status === "active"
      ? tokens.statusRunning
      : status === "completed"
        ? tokens.statusComplete
        : tokens.fg;

  const icon =
    status === "active" ? (
      <Spinner variant="dots" size="sm" />
    ) : (
      <Text
        color={
          status === "completed" ? tokens.statusComplete : tokens.statusPending
        }
      >
        {STEP_ICON[status]}
      </Text>
    );

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        {icon}
        <Text color={stepColor}>{name}</Text>
        {duration != null ? (
          <Text color={tokens.muted}>({duration}ms)</Text>
        ) : null}
      </Box>
      {substeps && substeps.length > 0 ? (
        <Box flexDirection="column" marginLeft={3}>
          {substeps.map((sub) => (
            <Box key={sub.id} gap={1}>
              <Badge variant={SUBSTEP_BADGE_VARIANT[sub.status]} size="sm">
                {sub.tag}
              </Badge>
              <Text
                color={
                  sub.status === "active"
                    ? tokens.statusRunning
                    : sub.status === "completed"
                      ? tokens.statusComplete
                      : sub.status === "error"
                        ? tokens.error
                        : tokens.fg
                }
              >
                {sub.label}
              </Text>
              {sub.detail ? (
                <Text color={tokens.muted}>{sub.detail}</Text>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
