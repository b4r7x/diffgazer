import {
  AGENT_EXECUTION_OPTIONS,
  type AgentExecution,
  isAgentExecution,
} from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { RadioGroup } from "../../../../components/ui/radio";
import { useTheme } from "../../../../theme/provider";

interface ExecutionStepProps {
  value?: AgentExecution;
  onChange: (value: AgentExecution) => void;
  isActive?: boolean;
}

export function ExecutionStep({
  value,
  onChange,
  isActive = true,
}: ExecutionStepProps): ReactElement {
  const { tokens } = useTheme();
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Agent Execution Mode:</Text>
      <RadioGroup
        value={value}
        onChange={(nextValue) => {
          if (isAgentExecution(nextValue)) onChange(nextValue);
        }}
        isActive={isActive}
      >
        {AGENT_EXECUTION_OPTIONS.map((option) => (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            label={option.label}
            description={option.description}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}
