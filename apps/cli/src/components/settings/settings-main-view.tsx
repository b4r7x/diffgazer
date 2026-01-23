import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { SettingsHeader } from "./settings-header.js";

interface SettingsMainViewProps {
  provider: string;
  model?: string;
}

export function SettingsMainView({ provider, model }: SettingsMainViewProps): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <SettingsHeader />

      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text dimColor>Provider: </Text>
          <Text>{provider}</Text>
        </Text>
        <Text>
          <Text dimColor>Model: </Text>
          <Text>{model ?? "Default"}</Text>
        </Text>
        <Text>
          <Text dimColor>API Key: </Text>
          <Text>{"•".repeat(10)}</Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>[d] Delete Configuration  [b] Back</Text>
      </Box>
    </Box>
  );
}
