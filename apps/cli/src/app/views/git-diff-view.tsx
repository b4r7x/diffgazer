import { Box, Text } from "ink";
import { GitDiffDisplay } from "../../components/git-diff-display.js";
import type { GitDiffState } from "../../hooks/use-git-diff.js";

export function GitDiffView({ state, staged }: { state: GitDiffState; staged: boolean }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <GitDiffDisplay state={state} staged={staged} />
      <Box marginTop={1}>
        <Text dimColor>
          [s] Toggle {staged ? "unstaged" : "staged"} [r] Refresh [b]
          Back [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
