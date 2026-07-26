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
    <Panel grow>
      <Panel.Header>Context</Panel.Header>
      <Panel.Content grow>
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
                  <Text color={tokens.muted} wrap="truncate-end">
                    Open Settings → Trust & Permissions to grant
                  </Text>
                </Box>
              }
            />
          )}
          <KeyValue
            label={rows.provider.label}
            value={
              <Box flexGrow={1} minWidth={1} overflow="hidden">
                {/* Like the path row: the model id is identified by both ends,
                    so a tight sidebar loses the middle rather than the tail. */}
                <Text wrap="truncate-middle">{rows.provider.value}</Text>
              </Box>
            }
          />
          <KeyValue
            label={rows.lastRun.label}
            value={
              <Box flexGrow={1} minWidth={1} overflow="hidden">
                <Text wrap="truncate-end">
                  {rows.lastRun.value}
                  {rows.lastRun.issueCount ? (
                    <Text color={tokens.warning}> {rows.lastRun.issueCount}</Text>
                  ) : null}
                </Text>
              </Box>
            }
          />
        </Box>
      </Panel.Content>
    </Panel>
  );
}
