import { getAgentDetail, getAgentStatusMeta } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { Badge } from "@diffgazer/ui/components/badge";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { cn } from "@diffgazer/ui/lib/utils";

const AGENT_STATUS_BARS = {
  queued: "bg-border",
  running: "bg-info",
  complete: "bg-success",
  error: "bg-error",
} as const;

interface AgentBoardProps {
  agents: AgentState[];
}

export function AgentBoard({ agents }: AgentBoardProps) {
  if (agents.length === 0) return null;

  return (
    <div className="mb-8">
      <SectionHeader variant="muted" bordered>
        Agent Board
      </SectionHeader>
      <div className="space-y-2">
        {agents.map((agent) => {
          const status = getAgentStatusMeta(agent.status);
          return (
            <div key={agent.id} className="border border-border bg-secondary/20 p-2">
              <div className="flex items-center gap-2">
                <Badge variant={agent.meta.badgeVariant ?? "info"} size="sm">
                  {agent.meta.badgeLabel}
                </Badge>
                <span className="text-sm font-bold text-foreground">{agent.meta.name}</span>
                <Badge variant={status.variant} size="sm" className="ml-auto">
                  {status.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {getAgentDetail(agent)}
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.round(agent.progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${agent.meta.name} progress`}
                className="mt-2 h-1 w-full bg-border"
              >
                <div
                  className={cn("h-1 transition-all", AGENT_STATUS_BARS[agent.status])}
                  style={{ width: `${Math.max(0, Math.min(100, agent.progress))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
