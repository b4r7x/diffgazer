import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { Spinner } from "../components/ui/spinner.js";

export function cliLoading(label: string): () => ReactNode {
  return () => <Spinner label={label} />;
}

export function cliError(): (err: Error) => ReactNode {
  return (err: Error) => (
    <Box>
      <Text color="red">Error: {err.message}</Text>
    </Box>
  );
}
