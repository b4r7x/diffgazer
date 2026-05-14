import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../../theme/theme-context.js";
import { StorageSelector } from "../../../settings/components/storage-selector.js";

interface StorageStepProps {
  value: string;
  onChange: (value: string) => void;
  isActive?: boolean;
}

export function StorageStep({
  value,
  onChange,
  isActive = true,
}: StorageStepProps): ReactElement {
  const { tokens } = useTheme();
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>
        Choose where Diffgazer stores your API keys and secrets.
      </Text>
      <StorageSelector value={value} onChange={onChange} isActive={isActive} />
    </Box>
  );
}
