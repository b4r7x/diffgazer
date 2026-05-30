import { Box, Text } from "ink";
import type {
  ProgressStatus,
  ProgressSubstepData,
} from "@diffgazer/core/schemas/presentation";
import { Spinner } from "../../../components/ui/spinner";
import { Badge } from "../../../components/ui/badge";
import { useTheme } from "../../../theme/theme-context";
import type { CliColorTokens } from "../../../theme/palettes";

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

function getStepColor(status: ProgressStatus, tokens: CliColorTokens): string {
  if (status === "active") return tokens.statusRunning;
  if (status === "completed") return tokens.statusComplete;
  return tokens.fg;
}

function getStepIconColor(status: ProgressStatus, tokens: CliColorTokens): string {
  if (status === "completed") return tokens.statusComplete;
  return tokens.statusPending;
}

type SubstepStatus = ProgressSubstepData["status"];

function getSubstepColor(status: SubstepStatus, tokens: CliColorTokens): string {
  if (status === "active") return tokens.statusRunning;
  if (status === "completed") return tokens.statusComplete;
  if (status === "error") return tokens.error;
  return tokens.fg;
}

export function ProgressStep({
  name,
  status,
  substeps,
  duration,
}: ProgressStepProps) {
  const { tokens } = useTheme();

  const stepColor = getStepColor(status, tokens);

  const icon =
    status === "active" ? (
      <Spinner variant="dots" size="sm" />
    ) : (
      <Text color={getStepIconColor(status, tokens)}>{STEP_ICON[status]}</Text>
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
              <Text color={getSubstepColor(sub.status, tokens)}>
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
