import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { SettingsHeader } from "./settings-header.js";

export function SettingsDeleteConfirm(): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <SettingsHeader />
      <Box marginTop={1} flexDirection="column">
        <Text color="yellow">Are you sure you want to delete your configuration?</Text>
        <Text dimColor>This will remove your API key and provider settings.</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[y] Yes, delete  [n] No, cancel</Text>
      </Box>
    </Box>
  );
}
