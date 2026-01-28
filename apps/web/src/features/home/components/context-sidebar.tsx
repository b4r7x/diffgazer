import { Panel, PanelHeader, PanelContent, InfoField } from '@/components/ui';

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

export function ContextSidebar({ context }: ContextSidebarProps) {
  return (
    <Panel className="w-full max-w-md lg:w-80 h-fit shrink-0">
      <PanelHeader>Context</PanelHeader>
      <PanelContent>
        {context.trustedDir && (
          <InfoField label="Trusted" color="blue">
            <span className="break-all font-mono opacity-90">{context.trustedDir}</span>
          </InfoField>
        )}
        {context.providerName && (
          <InfoField label="Provider" color="violet">
            <span className="opacity-90">
              {context.providerName}
              {context.providerMode && ` (${context.providerMode})`}
            </span>
          </InfoField>
        )}
        {context.lastRunId && (
          <InfoField label="Last Run" color="green">
            <div className="flex justify-between items-center">
              <span className="opacity-90">#{context.lastRunId}</span>
              {context.lastRunIssueCount !== undefined && (
                <span className="text-tui-yellow text-xs">
                  ({context.lastRunIssueCount} issues)
                </span>
              )}
            </div>
          </InfoField>
        )}
      </PanelContent>
    </Panel>
  );
}
