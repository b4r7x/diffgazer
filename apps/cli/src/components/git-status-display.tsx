import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { GitFileEntry } from "@repo/schemas/git";
import type { GitStatusState } from "../hooks/use-git-status.js";

function getStatusChar(file: GitFileEntry): string {
  return file.indexStatus !== " " ? file.indexStatus : file.workTreeStatus;
}

function FileList({
  title,
  files,
  color,
}: {
  title: string;
  files: GitFileEntry[];
  color: string;
}) {
  if (files.length === 0) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={color}>
        {title} ({files.length})
      </Text>
      {files.map((f) => (
        <Text key={f.path} color={color}>
          {" "}
          {getStatusChar(f)} {f.path}
        </Text>
      ))}
    </Box>
  );
}

export function GitStatusDisplay({ state }: { state: GitStatusState }) {
  if (state.status === "loading")
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Loading...</Text>
      </Box>
    );
  if (state.status === "error")
    return <Text color="red">Error: {state.error.message}</Text>;
  if (state.status !== "success")
    return <Text dimColor>Press 'r' to load</Text>;

  const { data } = state;
  return (
    <Box flexDirection="column">
      <Text>
        Branch:{" "}
        <Text bold color="green">
          {data.branch ?? "(none)"}
        </Text>
      </Text>
      {data.ahead > 0 && <Text color="green">ahead {data.ahead}</Text>}
      {data.behind > 0 && <Text color="red">behind {data.behind}</Text>}
      {!data.hasChanges && <Text color="green">Working tree clean</Text>}
      <FileList title="Staged" files={data.files.staged} color="green" />
      <FileList title="Unstaged" files={data.files.unstaged} color="yellow" />
      <FileList title="Untracked" files={data.files.untracked} color="gray" />
    </Box>
  );
}
