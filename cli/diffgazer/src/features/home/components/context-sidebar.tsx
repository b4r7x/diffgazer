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
          {/* The label carries each row's colour code (the web sidebar's ANSI
              readout: trust blue/amber, provider accent, last run success) and
              values stay in the plain foreground. */}
          {isTrusted ? (
            <KeyValue
              label={rows.trust.label}
              labelColor={tokens.info}
              value={
                <Box flexGrow={1} minWidth={1} overflow="hidden">
                  <Text color={tokens.fg} wrap="truncate-middle">
                    {rows.trust.value}
                  </Text>
                </Box>
              }
            />
          ) : (
            <KeyValue
              label={rows.trust.label}
              labelColor={tokens.warning}
              value={
                <Box flexDirection="column" flexGrow={1} minWidth={1} overflow="hidden">
                  <Text color={tokens.fg} wrap="truncate-middle">
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
            labelColor={tokens.accent}
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
            labelColor={tokens.success}
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
