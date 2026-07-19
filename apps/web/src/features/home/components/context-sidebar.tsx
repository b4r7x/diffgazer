import { buildHomeContextRows, type ContextInfo } from "@diffgazer/core/schemas/presentation";
import { Panel } from "@diffgazer/ui/components/panel";
import { useNavigate } from "@tanstack/react-router";
import { InfoField } from "./info-field";

interface ContextSidebarProps {
  context: ContextInfo;
  isTrusted: boolean;
  projectPath?: string;
  pending?: boolean;
}

export function ContextSidebar({
  context,
  isTrusted,
  projectPath,
  pending = false,
}: ContextSidebarProps) {
  const navigate = useNavigate();
  const rows = buildHomeContextRows({ context, isTrusted, projectPath });

  const navigateUnlessPending = (to: "/settings/providers" | "/settings/trust-permissions") => {
    if (pending) return;
    navigate({ to });
  };

  return (
    <Panel className="w-full max-w-md lg:w-80 h-fit shrink-0">
      <Panel.Header>
        <Panel.Title>Context</Panel.Title>
      </Panel.Header>
      <Panel.Content inert={pending || undefined}>
        {isTrusted ? (
          <InfoField label={rows.trust.label} color="blue">
            <span className="break-all font-mono opacity-90">{rows.trust.value}</span>
          </InfoField>
        ) : (
          <InfoField
            label={rows.trust.label}
            color="yellow"
            onClick={() => navigateUnlessPending("/settings/trust-permissions")}
            ariaLabel="Grant trust permissions"
          >
            <span className="break-all font-mono opacity-90">{rows.trust.value}</span>
            <span className="text-xs opacity-70 ml-2">Click to grant trust →</span>
          </InfoField>
        )}
        <InfoField
          label={rows.provider.label}
          color="violet"
          onClick={() => navigateUnlessPending("/settings/providers")}
          ariaLabel="Configure provider settings"
        >
          <span className="opacity-90">{rows.provider.value}</span>
        </InfoField>
        <InfoField label={rows.lastRun.label} color="green">
          <div className="flex justify-between items-center">
            <span className="opacity-90">{rows.lastRun.value}</span>
            {rows.lastRun.issueCount !== undefined && (
              <span className="text-warning-text text-xs">{rows.lastRun.issueCount}</span>
            )}
          </div>
        </InfoField>
      </Panel.Content>
    </Panel>
  );
}
