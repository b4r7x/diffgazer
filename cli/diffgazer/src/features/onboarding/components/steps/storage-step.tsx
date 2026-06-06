import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useTheme } from "../../../../app/providers/theme";
import { StorageSelector } from "../../../../components/shared/storage-selector";

interface StorageStepProps {
  value: string | null;
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
      <StorageSelector value={value ?? undefined} onChange={onChange} isActive={isActive} />
    </Box>
  );
}
