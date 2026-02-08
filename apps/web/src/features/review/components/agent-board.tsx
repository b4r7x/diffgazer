import { cn } from '@/utils/cn';
import { PanelHeader, Badge } from '@stargazer/ui';
import type { AgentState } from '@stargazer/schemas/events';

const AGENT_STATUS_META = {
  queued: { label: "WAIT", variant: "neutral", bar: "bg-tui-border" },
  running: { label: "RUN", variant: "info", bar: "bg-tui-blue" },
  complete: { label: "DONE", variant: "success", bar: "bg-tui-green" },
  error: { label: "FAIL", variant: "error", bar: "bg-tui-red" },
} as const;

interface AgentBoardProps {
  agents: AgentState[];
}

export function AgentBoard({ agents }: AgentBoardProps) {
  if (agents.length === 0) return null;

  return (
    <div className="mb-8">
      <PanelHeader variant="section-bordered">Agent Board</PanelHeader>
      <div className="space-y-2">
        {agents.map((agent) => {
          const status = AGENT_STATUS_META[agent.status];
          return (
            <div key={agent.id} className="border border-tui-border bg-tui-selection/20 p-2">
              <div className="flex items-center gap-2">
                <Badge variant={agent.meta.badgeVariant ?? "info"} size="sm">
                  {agent.meta.badgeLabel}
                </Badge>
                <span className="text-sm font-bold text-tui-fg">{agent.meta.name}</span>
                <Badge variant={status.variant} size="sm" className="ml-auto">
                  {status.label}
                </Badge>
              </div>
              <div className="text-xs text-tui-muted mt-1 truncate">
                {agent.currentAction ?? "Standing by"}
              </div>
              <div className="mt-2 h-1 w-full bg-tui-border">
                <div
                  className={cn("h-1 transition-all", status.bar)}
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
