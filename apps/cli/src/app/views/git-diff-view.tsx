import type { ReactElement } from "react";
import { Box } from "ink";
import { GitDiffDisplay } from "../../components/git-diff-display.js";
import type { GitDiffState } from "../../hooks/use-git-diff.js";
import type { Shortcut } from "../../components/ui/footer-bar.js";

export const GIT_DIFF_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "s", label: "Toggle staged" },
  { key: "r", label: "Refresh" },
  { key: "b", label: "Back" },
];

interface GitDiffViewProps {
  state: GitDiffState;
  staged: boolean;
}

export function GitDiffView({ state, staged }: GitDiffViewProps): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <GitDiffDisplay state={state} staged={staged} />
    </Box>
  );
}
