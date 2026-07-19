import { buildHomeContextRows, type ContextInfo } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { KeyValue } from "../../../components/ui/key-value";
import { Panel } from "../../../components/ui/panel";
import { useTheme } from "../../../theme/provider";

export interface ContextSidebarProps {
  context: ContextInfo;
  isTrusted: boolean;
  projectPath?: string;
}

export function ContextSidebar({ context, isTrusted, projectPath }: ContextSidebarProps) {
  const { tokens } = useTheme();
  const rows = buildHomeContextRows({ context, isTrusted, projectPath });

  return (
    <Panel>
      <Panel.Header>Context</Panel.Header>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          {isTrusted ? (
            <KeyValue
              label={rows.trust.label}
              value={
                <Box flexGrow={1} minWidth={1} overflow="hidden">
                  <Text color={tokens.info} wrap="truncate-middle">
                    {rows.trust.value}
                  </Text>
                </Box>
              }
            />
          ) : (
            <KeyValue
              label={rows.trust.label}
              value={
                <Box flexDirection="column" flexGrow={1} minWidth={1} overflow="hidden">
                  <Text color={tokens.warning} wrap="truncate-middle">
                    {rows.trust.value}
                  </Text>
                  <Text dimColor>Open Settings → Trust & Permissions to grant</Text>
                </Box>
              }
            />
          )}
          <KeyValue
            label={rows.provider.label}
            value={
              <Box flexGrow={1} minWidth={1} overflow="hidden">
                <Text wrap="truncate-end">{rows.provider.value}</Text>
              </Box>
            }
          />
          <KeyValue
            label={rows.lastRun.label}
            value={
              rows.lastRun.issueCount ? (
                <Box>
                  <Text>{rows.lastRun.value}</Text>
                  <Text color={tokens.warning}> {rows.lastRun.issueCount}</Text>
                </Box>
              ) : (
                rows.lastRun.value
              )
            }
          />
        </Box>
      </Panel.Content>
    </Panel>
  );
}
