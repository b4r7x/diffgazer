import { type IssueDetailsPresentation, sanitizeTerminalText } from "@diffgazer/core/review";
import { Box, Text } from "ink";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { SectionHeader } from "../../../../components/ui/section-header";
import { useTheme } from "../../../../theme/provider";

export function TraceTab({
  issueId,
  trace,
  scrollHeight,
  isActive,
}: {
  issueId: string;
  trace: IssueDetailsPresentation["trace"];
  scrollHeight: number;
  isActive: boolean;
}) {
  const { tokens } = useTheme();

  // The trace tab is only rendered when issue.trace is non-empty (the tab is
  // gated in IssueDetailsPane), so trace steps are always present here.
  return (
    <ScrollArea height={scrollHeight} isActive={isActive} contentIdentity={issueId}>
      <Box flexDirection="column" gap={1} paddingTop={1}>
        <SectionHeader variant="muted">Agent Trace</SectionHeader>
        {trace.map((step) => (
          <Box key={step.step} flexDirection="column">
            <Box gap={1}>
              <Text color={tokens.muted}>{`#${String(step.step)}`}</Text>
              <Text color={tokens.accent} bold>
                {sanitizeTerminalText(step.tool)}
              </Text>
              <Text color={tokens.muted}>{sanitizeTerminalText(step.timestamp)}</Text>
            </Box>
            <Box paddingLeft={2} flexDirection="column">
              <Text color={tokens.fg}>
                <Text color={tokens.muted}>{`${step.input.label} `}</Text>
                {sanitizeTerminalText(step.input.summary)}
              </Text>
              <Text color={tokens.fg}>
                <Text color={tokens.muted}>{`${step.output.label} `}</Text>
                {sanitizeTerminalText(step.output.summary)}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </ScrollArea>
  );
}
