import { getAgentDetail } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { Badge } from "@diffgazer/ui/components/badge";
import { Progress } from "@diffgazer/ui/components/progress";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Fragment } from "react";

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
      <div className="grid grid-cols-[auto_minmax(0,auto)_7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
        {agents.map((agent) => {
          const detail = getAgentDetail(agent);
          return (
            <Fragment key={agent.id}>
              <Badge
                variant={agent.meta.badgeVariant ?? "info"}
                size="sm"
                className="min-w-[48px] justify-center"
              >
                {agent.meta.badgeLabel}
              </Badge>
              <span className="text-sm font-bold text-foreground">{agent.meta.name}</span>
              <Progress
                value={agent.progress}
                size="sm"
                aria-label={`${agent.meta.name} progress`}
              />
              <span className="text-xs text-muted-foreground truncate" title={detail}>
                {detail}
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
