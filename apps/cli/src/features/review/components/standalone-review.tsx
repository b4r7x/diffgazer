import React, { useEffect } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { useReview } from "../hooks/use-review.js";
import { ReviewDisplay } from "./review-display.js";

interface StandaloneReviewProps {
  staged: boolean;
}

export function StandaloneReview({ staged }: StandaloneReviewProps): React.ReactElement {
  const { exit } = useApp();
  const { state, startReview } = useReview();

  useEffect(() => {
    void startReview(staged);
  }, [staged, startReview]);

  useEffect(() => {
    if (state.status === "success" || state.status === "error") {
      const timer = setTimeout(() => {
        exit();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.status, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Stargazer Code Review
        </Text>
        <Text color="gray"> ({staged ? "staged" : "unstaged"} changes)</Text>
      </Box>

      {state.status === "idle" && (
        <Text color="gray">Initializing...</Text>
      )}

      {state.status === "loading" && (
        <Box flexDirection="column">
          <Box>
            <Text color="cyan"><Spinner type="dots" /></Text>
            <Text> Analyzing code...</Text>
          </Box>
          {state.content && (
            <Box marginTop={1}>
              <Text color="gray">{state.content.slice(-200)}</Text>
            </Box>
          )}
        </Box>
      )}

      {state.status === "success" && (
        <Box flexDirection="column">
          <ReviewDisplay state={state} staged={staged} />
          <Box marginTop={1}>
            <Text color="green">Review complete. Saved to history.</Text>
          </Box>
        </Box>
      )}

      {state.status === "error" && (
        <Box>
          <Text color="red">Error: {state.error.message}</Text>
        </Box>
      )}
    </Box>
  );
}
