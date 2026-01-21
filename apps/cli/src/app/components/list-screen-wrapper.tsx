import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

interface ListScreenWrapperProps {
  title: string;
  state: "idle" | "loading" | "success" | "error";
  error: { message: string } | null;
  isEmpty: boolean;
  emptyMessage: string;
  emptyHints: string;
  loadingMessage?: string;
  children: ReactNode;
}

export function ListScreenWrapper({
  title,
  state,
  error,
  isEmpty,
  emptyMessage,
  emptyHints,
  loadingMessage = "Loading...",
  children,
}: ListScreenWrapperProps): ReactElement {
  // Loading state
  if (state === "loading") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> {loadingMessage}</Text>
        </Box>
      </Box>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Text color="red">Error: {error?.message ?? "Failed to load"}</Text>
        <Box marginTop={1}>
          <Text dimColor>[b] Back</Text>
        </Box>
      </Box>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Text dimColor>{"─".repeat(40)}</Text>
        <Box marginTop={1}>
          <Text>{emptyMessage}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{emptyHints}</Text>
        </Box>
      </Box>
    );
  }

  // Success state with content
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      <Text dimColor>{"─".repeat(40)}</Text>
      {children}
    </Box>
  );
}
