import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { GitStatusDisplay } from "../../components/git-status-display.js";
import type { GitStatusState } from "../../hooks/use-git-status.js";
import type { Shortcut } from "../../components/ui/footer-bar.js";

export const GIT_STATUS_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "r", label: "Refresh" },
  { key: "b", label: "Back" },
];

interface GitStatusViewProps {
  state: GitStatusState;
}

export function GitStatusView({ state }: GitStatusViewProps): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>Git Status</Text>
      <GitStatusDisplay state={state} />
    </Box>
  );
}
