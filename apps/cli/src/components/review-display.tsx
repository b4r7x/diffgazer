import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ReviewState } from "../hooks/use-review.js";
import type { ReviewIssue, ReviewSeverity } from "@repo/schemas/review";

const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  critical: "red",
  warning: "yellow",
  suggestion: "blue",
  nitpick: "gray",
};

function IssueItem({ issue }: { issue: ReviewIssue }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={SEVERITY_COLORS[issue.severity]} bold>
        [{issue.severity}] {issue.title}
      </Text>
      {issue.file && (
        <Text dimColor>  File: {issue.file}{issue.line ? `:${issue.line}` : ""}</Text>
      )}
      <Text>  {issue.description}</Text>
      {issue.suggestion && <Text color="green">  Fix: {issue.suggestion}</Text>}
    </Box>
  );
}

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
        {state.content && <Text dimColor>{state.content.slice(0, 200)}...</Text>}
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
