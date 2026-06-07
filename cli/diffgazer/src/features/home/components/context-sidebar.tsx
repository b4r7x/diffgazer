import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { useTheme } from "../../../app/providers/theme";
import { KeyValue } from "../../../components/ui/key-value";
import { Panel } from "../../../components/ui/panel";

export interface ContextSidebarProps {
  context: ContextInfo;
  isTrusted: boolean;
  projectPath?: string;
}

function formatProviderValue(name: string | undefined, mode: string | undefined): string {
  if (name == null) return "Not configured";
  if (mode == null) return name;
  return `${name} (${mode})`;
}

export function ContextSidebar({ context, isTrusted, projectPath }: ContextSidebarProps) {
  const { tokens } = useTheme();

  const providerValue = formatProviderValue(context.providerName, context.providerMode);
  const lastRunValue = renderLastRun(context.lastRunId, context.lastRunIssueCount, tokens.warning);

  return (
    <Panel>
      <Panel.Header>Context</Panel.Header>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          {isTrusted ? (
            <KeyValue
              label="Trusted"
              value={<Text color={tokens.info}>{context.trustedDir ?? projectPath ?? "—"}</Text>}
            />
          ) : (
            <KeyValue
              label="Not Trusted"
              value={
                <Box flexDirection="column">
                  <Text color={tokens.warning}>{projectPath ?? "—"}</Text>
                  <Text dimColor>Open Settings → Trust & Permissions to grant</Text>
                </Box>
              }
            />
          )}
          <KeyValue label="Provider" value={providerValue} />
          <KeyValue label="Last Run" value={lastRunValue} />
        </Box>
      </Panel.Content>
    </Panel>
  );
}

function renderLastRun(
  lastRunId: string | undefined,
  lastRunIssueCount: number | undefined,
  issuesColor: string,
) {
  if (lastRunId == null) return "None";
  if (lastRunIssueCount == null) return `#${lastRunId}`;
  return (
    <Box>
      <Text>#{lastRunId}</Text>
      <Text color={issuesColor}> ({lastRunIssueCount} issues)</Text>
    </Box>
  );
}
