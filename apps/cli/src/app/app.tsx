import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { GitStatusDisplay } from "../components/git-status-display.js";
import { useGitStatus } from "../hooks/use-git-status.js";

type View = "main" | "git-status";

interface AppProps {
  address: string;
}

export function App({ address }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("main");
  const gitStatus = useGitStatus(address);

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
      return;
    }

    if (input === "r") {
      void gitStatus.fetch();
    }
    if (input === "b" || key.escape) {
      setView("main");
      gitStatus.reset();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Stargazer</Text>
      <Text>Server: <Text color="blue">{address}</Text></Text>
      <Text color="green">Running</Text>

      {view === "main" ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>[g] Git Status  [q] Quit</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Git Status</Text>
          <GitStatusDisplay state={gitStatus.state} />
          <Box marginTop={1}><Text dimColor>[r] Refresh  [b] Back  [q] Quit</Text></Box>
        </Box>
      )}
    </Box>
  );
}
