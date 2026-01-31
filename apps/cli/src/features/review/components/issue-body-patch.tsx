import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { DiffLine } from "../../../components/ui/diff-line.js";
import { MAX_PATCH_LINES } from "../constants.js";

interface IssueBodyPatchProps {
  patch: string | null;
  onApply?: () => void;
  isApplying?: boolean;
}

export function IssueBodyPatch({
  patch,
  onApply,
  isApplying = false,
}: IssueBodyPatchProps): ReactElement {
  if (!patch) {
    return (
      <Box padding={1}>
        <Text dimColor>No patch available for this issue</Text>
      </Box>
    );
  }

  const lines = patch.split("\n");
  const displayLines = lines.slice(0, MAX_PATCH_LINES);
  const hasMore = lines.length > MAX_PATCH_LINES;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Suggested Patch</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
      >
        {displayLines.map((line, lineNumber) => (
          <DiffLine key={lineNumber} line={line} />
        ))}
        {hasMore && (
          <Text dimColor>
            ... ({lines.length - MAX_PATCH_LINES} more lines)
          </Text>
        )}
      </Box>

      {isApplying ? (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Applying patch...</Text>
        </Box>
      ) : (
        onApply && (
          <Box marginTop={1}>
            <Text dimColor>Press </Text>
            <Text color="green" bold>
              [a]
            </Text>
            <Text dimColor> to apply this patch</Text>
          </Box>
        )
      )}
    </Box>
  );
}
