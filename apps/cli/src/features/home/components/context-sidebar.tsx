import type { ReactElement } from "react";
import { Box, Text } from "ink";
import {
  Panel,
  PanelHeader,
  PanelContent,
} from "../../../components/ui/panel.js";
import { InfoField } from "../../../components/ui/info-field.js";

export interface ContextInfo {
  trustedDir?: string;
  providerName?: string;
  providerMode?: string;
  lastRunId?: string;
  lastRunIssueCount?: number;
}

interface ContextSidebarProps {
  context: ContextInfo;
}

export function ContextSidebar({ context }: ContextSidebarProps): ReactElement {
  return (
    <Panel>
      <PanelHeader>Context</PanelHeader>
      <PanelContent>
        {context.trustedDir && (
          <InfoField label="Trusted" color="blue">
            {context.trustedDir}
          </InfoField>
        )}
        {context.providerName && (
          <InfoField label="Provider" color="violet">
            {context.providerName + (context.providerMode ? ` (${context.providerMode})` : "")}
          </InfoField>
        )}
        {context.lastRunId && (
          <InfoField label="Last Run" color="green">
            <Box justifyContent="space-between">
              <Text>#{context.lastRunId}</Text>
              {context.lastRunIssueCount !== undefined && (
                <Text color="yellow">({context.lastRunIssueCount} issues)</Text>
              )}
            </Box>
          </InfoField>
        )}
      </PanelContent>
    </Panel>
  );
}
