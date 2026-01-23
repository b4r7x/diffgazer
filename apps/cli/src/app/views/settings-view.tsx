import type { ReactElement } from "react";
import { Box } from "ink";
import { SettingsScreen } from "../screens/settings-screen.js";

interface SettingsViewProps {
  provider: string;
  model?: string;
  settingsState: "idle" | "loading" | "success" | "error";
  deleteState: "idle" | "deleting" | "success" | "error";
  error?: { message: string } | null;
  onDelete: () => void;
  onBack: () => void;
}

export function SettingsView(props: SettingsViewProps): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <SettingsScreen {...props} />
    </Box>
  );
}
