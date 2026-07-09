import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text } from "ink";
import { KeyValue } from "../../../components/ui/key-value";
import { SectionHeader } from "../../../components/ui/section-header";
import { useTheme } from "../../../theme/provider";

interface ContextSnapshotPreviewProps {
  snapshot: ReviewContextResponse;
}

export function ContextSnapshotPreview({ snapshot }: ContextSnapshotPreviewProps) {
  const { tokens } = useTheme();
  const { graph, meta } = snapshot;

  const changedFiles = graph.changedFiles.length;
  const totalAdditions = graph.changedFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = graph.changedFiles.reduce((sum, f) => sum + f.deletions, 0);

  const projectName = sanitizeTerminalText(graph.root.split("/").pop() ?? graph.root);

  const labelWidth = 12;

  return (
    <Box flexDirection="column">
      <SectionHeader variant="muted" bordered>
        Context Snapshot
      </SectionHeader>
      <Box flexDirection="column" paddingTop={1} paddingLeft={1} gap={0}>
        <KeyValue label="Project" value={projectName} labelWidth={labelWidth} />
        <KeyValue label="Changed" value={pluralize(changedFiles, "file")} labelWidth={labelWidth} />
        {(totalAdditions > 0 || totalDeletions > 0) && (
          <KeyValue
            label="Diff"
            value={
              <Box>
                <Text color={tokens.success}>+{totalAdditions}</Text>
                <Text color={tokens.muted}> / </Text>
                <Text color={tokens.error}>-{totalDeletions}</Text>
              </Box>
            }
            labelWidth={labelWidth}
          />
        )}
        {graph.packages.length > 0 && (
          <KeyValue label="Packages" value={`${graph.packages.length}`} labelWidth={labelWidth} />
        )}
        <KeyValue
          label="Context"
          value={`${meta.charCount.toLocaleString()} chars`}
          labelWidth={labelWidth}
        />
      </Box>
    </Box>
  );
}
