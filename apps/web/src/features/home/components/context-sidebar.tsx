import { buildHomeContextRows, type ContextInfo } from "@diffgazer/core/schemas/presentation";
import { Panel } from "@diffgazer/ui/components/panel";
import { useNavigate } from "@tanstack/react-router";
import { PathValue } from "@/components/shared/path-value";
import { InfoField } from "./info-field";

interface ContextSidebarProps {
  context: ContextInfo;
  isTrusted: boolean;
  projectPath?: string;
  pending?: boolean;
}

const CONTEXT_TITLE_ID = "home-context-title";

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
    <Panel
      frame="viewfinder"
      aria-labelledby={CONTEXT_TITLE_ID}
      className="w-full lg:order-first lg:w-80 lg:shrink-0 xl:w-96"
    >
      <Panel.Label>
        <h2 id={CONTEXT_TITLE_ID}>Context</h2>
      </Panel.Label>
      <Panel.Content inert={pending || undefined}>
        {isTrusted ? (
          <InfoField label={rows.trust.label} tone="info">
            <PathValue value={rows.trust.value} />
          </InfoField>
        ) : (
          <InfoField
            label={rows.trust.label}
            tone="warning"
            onClick={() => navigateUnlessPending("/settings/trust-permissions")}
            ariaLabel="Grant trust permissions"
          >
            <PathValue value={rows.trust.value} />
            <span className="mt-1 block text-xs text-muted-foreground">Click to grant trust →</span>
          </InfoField>
        )}
        <InfoField
          label={rows.provider.label}
          onClick={() => navigateUnlessPending("/settings/providers")}
          ariaLabel="Configure provider settings"
        >
          <span className="block truncate">{rows.provider.value}</span>
        </InfoField>
        <InfoField label={rows.lastRun.label}>
          <div className="flex justify-between items-center gap-2">
            <span className="truncate">{rows.lastRun.value}</span>
            {rows.lastRun.issueCount !== undefined && (
              <span className="text-warning-text text-xs shrink-0">{rows.lastRun.issueCount}</span>
            )}
          </div>
        </InfoField>
      </Panel.Content>
    </Panel>
  );
}
