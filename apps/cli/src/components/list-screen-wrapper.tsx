import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ListState } from "../hooks/index.js";
import { Separator } from "./ui/separator.js";

interface ListScreenWrapperProps {
  title: string;
  state: ListState;
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

  if (isEmpty) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Separator />
        <Box marginTop={1}>
          <Text>{emptyMessage}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{emptyHints}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      <Separator />
      {children}
    </Box>
  );
}
