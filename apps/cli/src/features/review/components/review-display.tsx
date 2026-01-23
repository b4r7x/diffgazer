import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { truncate } from "@repo/core";
import type { ReviewState } from "../hooks/index.js";
import { IssueItem } from "./issue-item.js";

export function ReviewDisplay({ state, staged }: { state: ReviewState; staged: boolean }) {
  if (state.status === "idle") {
    return <Text dimColor>Press 'r' to start review</Text>;
  }

  if (state.status === "loading") {
    return (
      <Box flexDirection="column">
        <Box>
          <Spinner type="dots" />
          <Text> Reviewing {staged ? "staged" : "unstaged"} changes...</Text>
        </Box>
        {state.content && <Text dimColor>{truncate(state.content, 200)}</Text>}
      </Box>
    );
  }

  if (state.status === "error") {
    return <Text color="red">Error: {state.error.message}</Text>;
  }

  const { data } = state;
  return (
    <Box flexDirection="column">
      <Text bold color={staged ? "green" : "yellow"}>
        Code Review ({staged ? "Staged" : "Unstaged"})
      </Text>
      <Text>
        <Text bold>Summary:</Text> {data.summary}
      </Text>
      {data.overallScore !== undefined && (
        <Text><Text bold>Score:</Text> {data.overallScore}/10</Text>
      )}
      {data.issues.length > 0 ? (
        data.issues.map((issue, i) => <IssueItem key={i} issue={issue} />)
      ) : (
        <Text color="green">No issues found!</Text>
      )}
    </Box>
  );
}
