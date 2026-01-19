import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { GitStatusDisplay } from "../components/git-status-display.js";
import { GitDiffDisplay } from "../components/git-diff-display.js";
import { useGitStatus } from "../hooks/use-git-status.js";
import { useGitDiff } from "../hooks/use-git-diff.js";

type View = "main" | "git-status" | "git-diff";

interface AppProps {
  address: string;
}

export function App({ address }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("main");
  const gitStatus = useGitStatus(address);
  const gitDiff = useGitDiff(address);
  const [diffStaged, setDiffStaged] = useState(false);

  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }

    if (view === "main") {
      if (input === "g") {
        setView("git-status");
        void gitStatus.fetch();
      }
      if (input === "d") {
        setView("git-diff");
        setDiffStaged(false);
        void gitDiff.fetch(false);
      }
      return;
    }

    if (view === "git-status") {
      if (input === "r") {
        void gitStatus.fetch();
      }
      if (input === "b" || key.escape) {
        setView("main");
        gitStatus.reset();
      }
      return;
    }

    if (view === "git-diff") {
      if (input === "r") {
        void gitDiff.fetch(diffStaged);
      }
      if (input === "s") {
        const next = !diffStaged;
        setDiffStaged(next);
        void gitDiff.fetch(next);
      }
      if (input === "b" || key.escape) {
        setView("main");
        gitDiff.reset();
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Stargazer</Text>
      <Text>Server: <Text color="blue">{address}</Text></Text>
      <Text color="green">Running</Text>

      {view === "main" && (
        <Box flexDirection="column" marginTop={1}>
          <Text>[g] Git Status  [d] Git Diff  [q] Quit</Text>
        </Box>
      )}

      {view === "git-status" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Git Status</Text>
          <GitStatusDisplay state={gitStatus.state} />
          <Box marginTop={1}><Text dimColor>[r] Refresh  [b] Back  [q] Quit</Text></Box>
        </Box>
      )}

      {view === "git-diff" && (
        <Box flexDirection="column" marginTop={1}>
          <GitDiffDisplay state={gitDiff.state} staged={diffStaged} />
          <Box marginTop={1}>
            <Text dimColor>[s] Toggle {diffStaged ? "unstaged" : "staged"}  [r] Refresh  [b] Back  [q] Quit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
