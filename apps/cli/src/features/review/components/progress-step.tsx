import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import { useTheme } from "../../../theme/theme-context.js";

export interface ProgressStepProps {
  name: string;
  status: "pending" | "running" | "complete" | "error";
  substeps?: string[];
  duration?: number;
}

export function ProgressStep({ name, status, substeps, duration }: ProgressStepProps) {
  const { tokens } = useTheme();

  const icon =
    status === "running" ? (
      <Text color={tokens.statusRunning}>
        <InkSpinner type="dots" />
      </Text>
    ) : status === "complete" ? (
      <Text color={tokens.statusComplete}>{"\u25CF"}</Text>
    ) : status === "error" ? (
      <Text color={tokens.error}>{"\u2716"}</Text>
    ) : (
      <Text color={tokens.statusPending}>{"\u25CB"}</Text>
    );

  const nameColor =
    status === "running"
      ? tokens.statusRunning
      : status === "complete"
        ? tokens.statusComplete
        : status === "error"
          ? tokens.error
          : tokens.fg;

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        {icon}
        <Text color={nameColor}>{name}</Text>
        {duration != null ? (
          <Text color={tokens.muted}>({duration}ms)</Text>
        ) : null}
      </Box>
      {substeps && substeps.length > 0 ? (
        <Box flexDirection="column" marginLeft={3}>
          {substeps.map((sub) => (
            <Text key={sub} color={tokens.muted}>
              {sub}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
