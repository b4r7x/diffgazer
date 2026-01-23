import type { ComponentProps } from "react";
import { Box } from "ink";
import { SettingsScreen } from "../screens/settings-screen.js";

export function SettingsView(props: ComponentProps<typeof SettingsScreen>) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <SettingsScreen {...props} />
    </Box>
  );
}
