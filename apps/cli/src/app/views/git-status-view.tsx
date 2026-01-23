import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { GitStatusDisplay } from "../../components/git-status-display.js";
import type { GitStatusState } from "../../hooks/use-git-status.js";

interface GitStatusViewProps {
  state: GitStatusState;
}

export function GitStatusView({ state }: GitStatusViewProps): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>Git Status</Text>
      <GitStatusDisplay state={state} />
      <Box marginTop={1}>
        <Text dimColor>[r] Refresh [b] Back [q] Quit</Text>
      </Box>
    </Box>
  );
}
