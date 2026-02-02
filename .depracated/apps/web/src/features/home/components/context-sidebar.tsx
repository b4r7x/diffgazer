import { useNavigate } from '@tanstack/react-router';
import { Panel, PanelHeader, PanelContent, InfoField } from '@/components/ui';
import type { ContextInfo } from "@repo/schemas/ui";

interface ContextSidebarProps {
  context: ContextInfo;
  isTrusted: boolean;
  projectPath?: string;
}

export function ContextSidebar({ context, isTrusted, projectPath }: ContextSidebarProps) {
  const navigate = useNavigate();

  return (
    <Panel className="w-full max-w-md lg:w-80 h-fit shrink-0">
      <PanelHeader>Context</PanelHeader>
      <PanelContent>
        {isTrusted ? (
          context.trustedDir && (
            <InfoField label="Trusted" color="blue">
              <span className="break-all font-mono opacity-90">{context.trustedDir}</span>
            </InfoField>
          )
        ) : (
          <InfoField
            label="Not Trusted"
            color="yellow"
            onClick={() => navigate({ to: '/settings/trust-permissions' })}
            ariaLabel="Grant trust permissions"
          >
            <span className="break-all font-mono opacity-90">{projectPath}</span>
            <span className="text-xs opacity-70 ml-2">Click to grant trust &rarr;</span>
          </InfoField>
        )}
        {context.providerName && (
          <InfoField label="Provider" color="violet" onClick={() => navigate({ to: '/settings/providers' })} ariaLabel="Configure provider settings">
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
