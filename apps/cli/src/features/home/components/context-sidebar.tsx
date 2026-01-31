import type { ReactElement } from "react";
import { Box, Text } from "ink";
import {
  Panel,
  PanelHeader,
  PanelContent,
} from "../../../components/ui/layout/index.js";
import { InfoField } from "../../../components/ui/info-field.js";
import type { ContextInfo } from "@repo/schemas/ui";

export type { ContextInfo };

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
