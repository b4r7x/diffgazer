import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { EvidenceRef, EvidenceType } from "@repo/schemas/triage";

const EVIDENCE_TYPE_COLORS: Record<EvidenceType, string> = {
  code: "cyan",
  doc: "blue",
  trace: "magenta",
  external: "yellow",
};

const EVIDENCE_TYPE_ICONS: Record<EvidenceType, string> = {
  code: "[CODE]",
  doc: "[DOC]",
  trace: "[TRACE]",
  external: "[EXT]",
};

function EvidenceItem({ evidence }: { evidence: EvidenceRef }): ReactElement {
  const color = EVIDENCE_TYPE_COLORS[evidence.type];
  const icon = EVIDENCE_TYPE_ICONS[evidence.type];

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={color} bold>
          {icon}
        </Text>
        <Text bold>{evidence.title}</Text>
      </Box>

      {evidence.file && (
        <Box marginLeft={2}>
          <Text dimColor>
            {evidence.file}
            {evidence.range && `:${evidence.range.start}-${evidence.range.end}`}
          </Text>
        </Box>
      )}

      <Box marginLeft={2} marginTop={1}>
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text wrap="wrap">{evidence.excerpt}</Text>
        </Box>
      </Box>

      {evidence.sha && (
        <Box marginLeft={2}>
          <Text dimColor>sha: {evidence.sha.slice(0, 8)}</Text>
        </Box>
      )}
    </Box>
  );
}

interface IssueBodyExplainProps {
  evidence: EvidenceRef[];
}

export function IssueBodyExplain({
  evidence,
}: IssueBodyExplainProps): ReactElement {
  if (evidence.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No evidence available for this issue</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Evidence ({evidence.length})</Text>
      </Box>

      {evidence.map((item) => (
        <EvidenceItem key={item.sourceId} evidence={item} />
      ))}
    </Box>
  );
}
