import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { GitDiffState } from "../hooks/use-git-diff.js";

function DiffLine({ line }: { line: string }) {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return <Text color="green">{line}</Text>;
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return <Text color="red">{line}</Text>;
  }
  if (line.startsWith("@@")) {
    return <Text color="cyan">{line}</Text>;
  }
  if (line.startsWith("diff ") || line.startsWith("index ")) {
    return <Text bold>{line}</Text>;
  }
  return <Text>{line}</Text>;
}

export function GitDiffDisplay({ state, staged }: { state: GitDiffState; staged: boolean }) {
  if (state.status === "loading") {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Loading diff...</Text>
      </Box>
    );
  }

  if (state.status === "error") {
    return <Text color="red">Error: {state.error.message}</Text>;
  }

  if (state.status !== "success") {
    return <Text dimColor>Press 'r' to load</Text>;
  }

  const { data } = state;
  const isEmpty = data.diff.trim().length === 0;

  if (isEmpty) {
    return <Text color="green">No {staged ? "staged" : "unstaged"} changes</Text>;
  }

  const lines = data.diff.split("\n");

  return (
    <Box flexDirection="column">
      <Text bold color={staged ? "green" : "yellow"}>
        {staged ? "Staged" : "Unstaged"} Changes
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {lines.slice(0, 50).map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
        {lines.length > 50 && (
          <Text dimColor>... ({lines.length - 50} more lines)</Text>
        )}
      </Box>
    </Box>
  );
}
