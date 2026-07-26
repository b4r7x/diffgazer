import type { ProgressStatus, ProgressSubstepData } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { Badge } from "../../../../components/ui/badge";
import type { CliColorTokens } from "../../../../theme/palettes";
import { useTheme } from "../../../../theme/provider";

export interface ProgressStepProps {
  name: string;
  status: ProgressStatus;
  substeps?: ProgressSubstepData[];
}

/**
 * Every step state prints a glyph in the same single-cell column, so the label
 * column starts at one x position and the active step is told apart from the
 * pending ones by shape as well as by colour. The active marker is a static
 * glyph, not a spinner: a nested animated box collapses to zero height when the
 * overview pane shrinks, which drops the one row the user is watching.
 */
const STEP_ICON = {
  completed: "*",
  pending: "\u00b7",
  active: ">",
} satisfies Record<ProgressStatus, string>;

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
  if (status === "active") return tokens.statusRunning;
  return tokens.statusPending;
}

type SubstepStatus = ProgressSubstepData["status"];

function getSubstepColor(status: SubstepStatus, tokens: CliColorTokens): string {
  if (status === "active") return tokens.statusRunning;
  if (status === "completed") return tokens.statusComplete;
  if (status === "error") return tokens.error;
  return tokens.fg;
}

export function ProgressStep({ name, status, substeps }: ProgressStepProps) {
  const { tokens } = useTheme();

  const stepColor = getStepColor(status, tokens);

  return (
    // Steps never shrink: yoga spreads a row deficit across the rows and zeroes
    // out whichever one it lands on, so the list windows itself instead.
    <Box flexDirection="column" flexShrink={0}>
      <Box gap={1}>
        <Box width={1} flexShrink={0}>
          <Text color={getStepIconColor(status, tokens)}>{STEP_ICON[status]}</Text>
        </Box>
        <Text color={stepColor}>{name}</Text>
      </Box>
      {substeps && substeps.length > 0 ? (
        <Box flexDirection="column" marginLeft={3}>
          {substeps.map((sub) => (
            <Box key={sub.id} gap={1}>
              <Badge variant={SUBSTEP_BADGE_VARIANT[sub.status]} size="sm">
                {sub.tag}
              </Badge>
              <Text color={getSubstepColor(sub.status, tokens)}>{sub.label}</Text>
              {sub.detail ? <Text color={tokens.muted}>{sub.detail}</Text> : null}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
