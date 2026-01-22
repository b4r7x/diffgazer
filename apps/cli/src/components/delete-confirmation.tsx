import type { ReactElement } from "react";
import { Box, Text } from "ink";

interface DeleteConfirmationProps {
  itemType: string;
}

export function DeleteConfirmation({ itemType }: DeleteConfirmationProps): ReactElement {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="yellow">Delete this {itemType}?</Text>
      <Text dimColor>[y] Yes [n] No</Text>
    </Box>
  );
}
