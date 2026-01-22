import { Box, Text } from "ink";
import type { ReviewIssue } from "@repo/schemas/review";
import { SEVERITY_COLORS } from "../constants.js";

export function IssueItem({ issue }: { issue: ReviewIssue }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={SEVERITY_COLORS[issue.severity]} bold>
        [{issue.severity}] {issue.title}
      </Text>
      {issue.file && (
        <Text dimColor>
          {"  "}File: {issue.file}
          {issue.line ? `:${issue.line}` : ""}
        </Text>
      )}
      <Text>{"  "}{issue.description}</Text>
      {issue.suggestion && <Text color="green">{"  "}Fix: {issue.suggestion}</Text>}
    </Box>
  );
}
