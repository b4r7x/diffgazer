import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../../theme/theme-context.js";
import { RadioGroup } from "../../../../components/ui/radio.js";

interface ExecutionStepProps {
  value?: string;
  onChange: (v: string) => void;
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
      <RadioGroup value={value} onChange={onChange} isActive={isActive}>
        <RadioGroup.Item
          value="sequential"
          label="Sequential"
          description="Agents run one after another. Works with all providers and tiers."
        />
        <RadioGroup.Item
          value="parallel"
          label="Parallel"
          description="All agents run at once. Faster, but may hit rate limits on free tiers."
        />
      </RadioGroup>
    </Box>
  );
}
